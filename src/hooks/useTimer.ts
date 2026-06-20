// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface TimeTrackingSession {
  id: string;
  user_id: string;
  login_time: string;
  logout_time: string | null;
  total_seconds: number;
  is_active: boolean;
}

export function useTimer(userId: string | undefined) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedSecondsRef = useRef(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const updateIntervalRef = useRef<number | null>(null);

  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const startSession = async () => {
    if (!userId) return;

    try {
      const { data: existingSession } = await (supabase
        .from('time_tracking_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('login_time', { ascending: false })
        .limit(1)
        .maybeSingle() as any);

      if (existingSession) {
        setSessionId(existingSession.id);
        const loginTime = new Date(existingSession.login_time).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - loginTime) / 1000);
        setElapsedSeconds(elapsed);
        elapsedSecondsRef.current = elapsed;
      } else {
        const { data: profile } = await (supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', userId)
          .single() as any);

        const { data: newSession, error } = await (supabase
          .from('time_tracking_sessions')
          .insert({
            user_id: userId,
            login_time: new Date().toISOString(),
            is_active: true,
            total_seconds: 0,
            organization_id: profile?.organization_id || null,
          })
          .select()
          .single() as any);

        if (error) throw error;

        if (newSession) {
          setSessionId(newSession.id);
          setElapsedSeconds(0);
          elapsedSecondsRef.current = 0;
        }
      }
    } catch (error) {
      console.error('Error starting time tracking session:', error);
    }
  };

  const updateSession = async () => {
    if (!sessionId || !userId) return;

    try {
      await (supabase
        .from('time_tracking_sessions')
        .update({
          total_seconds: elapsedSecondsRef.current,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .eq('user_id', userId) as any);
    } catch (error) {
      console.error('Error updating time tracking session:', error);
    }
  };

  const endSession = async () => {
    if (!sessionId || !userId) return;

    try {
      await (supabase
        .from('time_tracking_sessions')
        .update({
          logout_time: new Date().toISOString(),
          total_seconds: elapsedSecondsRef.current,
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .eq('user_id', userId) as any);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    } catch (error) {
      console.error('Error ending time tracking session:', error);
    }
  };

  useEffect(() => {
    if (userId) {
      startSession();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [userId]);

  useEffect(() => {
    if (sessionId) {
      intervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          elapsedSecondsRef.current = next;
          return next;
        });
      }, 1000);

      updateIntervalRef.current = window.setInterval(() => {
        updateSession();
      }, 30000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
        }
      };
    }
  }, [sessionId]);

  return {
    elapsedSeconds,
    formattedTime: formatTime(elapsedSeconds),
    endSession,
  };
}
