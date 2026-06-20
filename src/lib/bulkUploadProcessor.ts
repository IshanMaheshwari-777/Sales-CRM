// @ts-nocheck
import { supabase } from './supabase';
import { normalizeMobileNumber, validateLeadRow, BATCH_SIZE, ValidatedRow } from './csvUtils';

export interface ProcessingProgress {
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  skippedRows: number;
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemaining?: number;
}

export interface BulkUploadResult {
  success: boolean;
  jobId: string;
  summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  errors: Array<{
    rowNumber: number;
    data: Record<string, string>;
    errors: string[];
  }>;
}

export type DuplicateStrategy = 'skip' | 'update' | 'create_new';

export type ProgressCallback = (progress: ProcessingProgress) => void;

export class BulkUploadProcessor {
  private jobId: string | null = null;
  private startTime: number = 0;
  private sourcesCache: any[] | null = null;
  private statusesCache: any[] | null = null;
  private defaultStatusId: string | null = null;
  private defaultSubStatusId: string | null = null;

  async createUploadJob(
    filename: string,
    fileSize: number,
    totalRows: number,
    duplicateStrategy: DuplicateStrategy,
    columnMapping: Record<string, string>
  ): Promise<string> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('User not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userData.user.id)
      .single();

    let organizationId = profile?.organization_id || null;
    if (!organizationId) {
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('profile_id', userData.user.id)
        .limit(1)
        .maybeSingle();
      organizationId = member?.organization_id || null;
    }

    const { data, error } = await (supabase
      .from('bulk_upload_jobs')
      .insert({
        user_id: userData.user.id,
        filename,
        file_size_bytes: fileSize,
        total_rows: totalRows,
        duplicate_handling_strategy: duplicateStrategy,
        column_mapping: columnMapping,
        status: 'validating',
        organization_id: organizationId,
      })
      .select()
      .single() as any);

    if (error) {
      throw new Error(`Failed to create upload job: ${error.message}`);
    }

    this.jobId = data.id;
    return data.id;
  }

  async updateJobStatus(
    jobId: string,
    status: string,
    updates: Partial<{
      processed_rows: number;
      successful_rows: number;
      failed_rows: number;
      skipped_rows: number;
      error_log: unknown[];
      started_processing_at: string;
      completed_at: string;
    }>
  ): Promise<void> {
    const { error } = await (supabase
      .from('bulk_upload_jobs')
      .update({ status, ...updates })
      .eq('id', jobId) as any);

    if (error) {
      console.error('Failed to update job status:', error);
    }
  }

  async detectDuplicates(
    rows: Record<string, string>[],
    columnMapping: Record<string, string>
  ): Promise<Map<number, string>> {
    const duplicates = new Map<number, string>();
    const mobileNumberField = columnMapping.mobile_number;

    if (!mobileNumberField) {
      return duplicates;
    }

    const mobileNumbers = rows
      .map((row, index) => ({
        index,
        mobile: normalizeMobileNumber(row[mobileNumberField] || ''),
      }))
      .filter((item) => item.mobile);

    if (mobileNumbers.length === 0) {
      return duplicates;
    }

    const mobilesToCheck = mobileNumbers.map((item) => item.mobile);

    const { data: existingLeads, error } = await supabase
      .from('leads')
      .select('id, mobile_number')
      .in('mobile_number', mobilesToCheck);

    if (error) {
      console.error('Error checking duplicates:', error);
      return duplicates;
    }

    if (existingLeads && existingLeads.length > 0) {
      const existingMap = new Map(
        existingLeads.map((lead) => [lead.mobile_number, lead.id])
      );

      mobileNumbers.forEach((item) => {
        const existingId = existingMap.get(item.mobile);
        if (existingId) {
          duplicates.set(item.index, existingId);
        }
      });
    }

    return duplicates;
  }

  private async lookupSourceId(sourceName: string): Promise<string | null> {
    if (!this.sourcesCache) {
      const { data } = await supabase.from('lead_sources').select('id, name');
      this.sourcesCache = data || [];
    }
    const source = this.sourcesCache.find((s) => s.name.toLowerCase() === sourceName.toLowerCase());
    return source?.id || null;
  }

  private async lookupStatusIds(
    statusName: string,
    subStatusName?: string
  ): Promise<{ statusId: string | null; subStatusId: string | null }> {
    if (!this.statusesCache) {
      const { data } = await supabase
        .from('lead_statuses')
        .select('id,name,parent_status_id,status_type,display_name') as any;
      this.statusesCache = data || [];
    }

    const mainStatus = this.statusesCache!.find(
      (s) => s.status_type === 'main' && s.name.toLowerCase() === statusName.toLowerCase()
    );

    if (!mainStatus) return { statusId: null, subStatusId: null };

    if (subStatusName) {
      const subStatus = this.statusesCache!.find(
        (s) =>
          s.status_type === 'sub' &&
          s.parent_status_id === mainStatus.id &&
          s.name.toLowerCase() === subStatusName.toLowerCase()
      );

      return {
        statusId: mainStatus.id,
        subStatusId: subStatus?.id || null,
      };
    }

    return { statusId: mainStatus.id, subStatusId: null };
  }

  async processBatch(
    rows: Record<string, string>[],
    columnMapping: Record<string, string>,
    duplicateStrategy: DuplicateStrategy,
    duplicateMap: Map<number, string>,
    startIndex: number
  ): Promise<{
    successful: number;
    failed: number;
    skipped: number;
    errors: Array<{ rowNumber: number; data: Record<string, string>; errors: string[] }>;
  }> {
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    const errors: Array<{ rowNumber: number; data: Record<string, string>; errors: string[] }> = [];

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('User not authenticated');
    }

    if (!this.statusesCache) {
      const { data } = await (supabase
        .from('lead_statuses')
        .select('id,name,parent_status_id,status_type,display_name') as any);
      this.statusesCache = data || [];
      
      const mainStatuses = this.statusesCache!.filter(s => s.status_type === 'main');
      const subStatuses = this.statusesCache!.filter(s => s.status_type === 'sub');
      
      const newLeadStatus = mainStatuses.find(s => 
        s.name.toLowerCase() === 'new lead' || 
        (s.display_name && s.display_name.toLowerCase() === '1- new lead')
      );

      if (newLeadStatus) {
        this.defaultStatusId = newLeadStatus.id;
        const untouchedSubStatus = subStatuses.find(s => 
          s.parent_status_id === newLeadStatus.id && 
          (s.name.toLowerCase() === 'untouched' || (s.display_name && s.display_name.toLowerCase() === 'untouched'))
        );
        if (untouchedSubStatus) {
          this.defaultSubStatusId = untouchedSubStatus.id;
        }
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userData.user.id)
      .single();

    let organizationId = profile?.organization_id || null;
    if (!organizationId) {
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('profile_id', userData.user.id)
        .limit(1)
        .maybeSingle();
      organizationId = member?.organization_id || null;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = startIndex + i + 1;
      const absoluteIndex = startIndex + i;

      const mappedData: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([systemField, csvField]) => {
        if (csvField && row[csvField] !== undefined) {
          mappedData[systemField] = row[csvField];
        }
      });

      const validation = validateLeadRow(mappedData, rowNumber);

      if (!validation.isValid) {
        failed++;
        errors.push({
          rowNumber,
          data: row,
          errors: validation.errors.map((e) => `${e.field}: ${e.message}`),
        });
        continue;
      }

      const isDuplicate = duplicateMap.has(absoluteIndex);
      const existingLeadId = duplicateMap.get(absoluteIndex);

      if (isDuplicate && duplicateStrategy === 'skip') {
        skipped++;
        continue;
      }

      try {
        const mobileNumber = normalizeMobileNumber(mappedData.mobile_number || '');
        const firstName = mappedData.first_name || '';
        const lastName = mappedData.last_name || '';
        const name = `${firstName} ${lastName}`.trim() || 'Unknown';

        let sourceId: string | null = null;
        if (mappedData.source) {
          sourceId = await this.lookupSourceId(mappedData.source);
          if (!sourceId) {
            failed++;
            errors.push({
              rowNumber,
              data: row,
              errors: [`Source '${mappedData.source}' not found in system`],
            });
            continue;
          }
        }

        let statusId: string | null = null;
        let subStatusId: string | null = null;

        if (mappedData.stage && mappedData.sub_stage) {
          const result = await this.lookupStatusIds(mappedData.stage, mappedData.sub_stage);
          statusId = result.statusId;
          subStatusId = result.subStatusId;

          if (!statusId) {
            failed++;
            errors.push({
              rowNumber,
              data: row,
              errors: [`Status '${mappedData.stage}' not found in system`],
            });
            continue;
          }

          if (!subStatusId) {
            failed++;
            errors.push({
              rowNumber,
              data: row,
              errors: [`Sub-status '${mappedData.sub_stage}' not found for status '${mappedData.stage}'`],
            });
            continue;
          }
        } else if (mappedData.stage) {
          const result = await this.lookupStatusIds(mappedData.stage);
          statusId = result.statusId;

          if (!statusId) {
            failed++;
            errors.push({
              rowNumber,
              data: row,
              errors: [`Status '${mappedData.stage}' not found in system`],
            });
            continue;
          }
        } else {
          statusId = this.defaultStatusId;
          subStatusId = this.defaultSubStatusId;
        }

        if (isDuplicate && duplicateStrategy === 'update' && existingLeadId) {
          const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if (mappedData.email) updateData.email = mappedData.email;
          if (mappedData.university) updateData.university = mappedData.university;
          if (mappedData.course) updateData.course = mappedData.course;
          if (mappedData.specialization) updateData.specialization = mappedData.specialization;
          if (mappedData.city) updateData.city = mappedData.city;
          if (mappedData.country) updateData.country = mappedData.country;
          if (mappedData.channel) updateData.channel = mappedData.channel;
          if (mappedData.campaign_name) updateData.campaign_name = mappedData.campaign_name;
          if (sourceId) updateData.source_id = sourceId;
          if (statusId) updateData.status_id = statusId;
          if (subStatusId) updateData.sub_status_id = subStatusId;

          const { error: updateError } = await supabase
            .from('leads')
            .update(updateData)
            .eq('id', existingLeadId);

          if (updateError) {
            failed++;
            errors.push({
              rowNumber,
              data: row,
              errors: [`Failed to update: ${updateError.message}`],
            });
          } else {
            successful++;
          }
        } else {
          const insertData: Record<string, unknown> = {
            mobile_number: mobileNumber,
            name,
            first_name: firstName || null,
            last_name: lastName || null,
            email: mappedData.email || null,
            university: mappedData.university || null,
            course: mappedData.course || null,
            specialization: mappedData.specialization || null,
            city: mappedData.city || null,
            country: mappedData.country || null,
            channel: mappedData.channel || null,
            campaign_name: mappedData.campaign_name || null,
            source_id: sourceId,
            status_id: statusId,
            sub_status_id: subStatusId,
            call_count: 0,
            is_re_enquired: isDuplicate && duplicateStrategy === 'create_new',
            original_enquiry_date: new Date().toISOString(),
            created_by: userData.user.id,
            current_lead_owner: userData.user.id,
            assigned_to: userData.user.id,
            organization_id: organizationId,
          };

          const { error: insertError } = await supabase.from('leads').insert(insertData);

          if (insertError) {
            failed++;
            errors.push({
              rowNumber,
              data: row,
              errors: [`Failed to insert: ${insertError.message}`],
            });
          } else {
            successful++;
          }
        }
      } catch (error) {
        failed++;
        errors.push({
          rowNumber,
          data: row,
          errors: [(error as Error).message],
        });
      }
    }

    return { successful, failed, skipped, errors };
  }

  async processUpload(
    jobId: string,
    rows: Record<string, string>[],
    columnMapping: Record<string, string>,
    duplicateStrategy: DuplicateStrategy,
    onProgress?: ProgressCallback
  ): Promise<BulkUploadResult> {
    this.jobId = jobId;
    this.startTime = Date.now();

    await this.updateJobStatus(jobId, 'processing', {
      started_processing_at: new Date().toISOString(),
    });

    const duplicateMap = await this.detectDuplicates(rows, columnMapping);

    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const allErrors: Array<{ rowNumber: number; data: Record<string, string>; errors: string[] }> = [];

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * BATCH_SIZE;
      const endIndex = Math.min(startIndex + BATCH_SIZE, rows.length);
      const batchRows = rows.slice(startIndex, endIndex);

      const result = await this.processBatch(
        batchRows,
        columnMapping,
        duplicateStrategy,
        duplicateMap,
        startIndex
      );

      totalSuccessful += result.successful;
      totalFailed += result.failed;
      totalSkipped += result.skipped;
      allErrors.push(...result.errors);

      const processedRows = endIndex;
      const progress: ProcessingProgress = {
        totalRows: rows.length,
        processedRows,
        successfulRows: totalSuccessful,
        failedRows: totalFailed,
        skippedRows: totalSkipped,
        currentBatch: batchIndex + 1,
        totalBatches,
      };

      if (batchIndex > 0) {
        const elapsed = Date.now() - this.startTime;
        const rate = processedRows / elapsed;
        const remaining = rows.length - processedRows;
        progress.estimatedTimeRemaining = Math.ceil(remaining / rate);
      }

      await this.updateJobStatus(jobId, 'processing', {
        processed_rows: processedRows,
        successful_rows: totalSuccessful,
        failed_rows: totalFailed,
        skipped_rows: totalSkipped,
      });

      if (onProgress) {
        onProgress(progress);
      }
    }

    await this.updateJobStatus(jobId, 'completed', {
      processed_rows: rows.length,
      successful_rows: totalSuccessful,
      failed_rows: totalFailed,
      skipped_rows: totalSkipped,
      error_log: allErrors,
      completed_at: new Date().toISOString(),
    });

    return {
      success: true,
      jobId,
      summary: {
        total: rows.length,
        successful: totalSuccessful,
        failed: totalFailed,
        skipped: totalSkipped,
      },
      errors: allErrors,
    };
  }
}
