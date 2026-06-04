import React from 'react';
import { Text } from 'react-native';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function createIcon(fallback: string) {
  const IconComponent = ({ size = 18, color = '#111827' }: IconProps) => {
    return (
      <Text
        style={{
          color,
          fontSize: size,
          lineHeight: size,
          textAlign: 'center',
          minWidth: size,
          fontWeight: '700',
        }}
      >
        {fallback}
      </Text>
    );
  };

  return IconComponent;
}

export const ArrowLeft = createIcon('<');
export const ArrowRight = createIcon('>');
export const Bell = createIcon('o');
export const Building2 = createIcon('#');
export const Calendar = createIcon('[]');
export const CalendarClock = createIcon('o');
export const CheckCircle2 = createIcon('Y');
export const Circle = createIcon('o');
export const CircleAlert = createIcon('!');
export const Clock = createIcon('o');
export const LogOut = createIcon('>');
export const Mail = createIcon('@');
export const MessageCircle = createIcon('o');
export const Phone = createIcon('P');
export const PhoneCall = createIcon('P');
export const RefreshCcw = createIcon('R');
export const Search = createIcon('?');
export const Shield = createIcon('S');
export const Signal = createIcon('|');
export const User = createIcon('U');
export const Users = createIcon('U');
export const Filter = createIcon('=');
export const Home = createIcon('H');
export const MoreHorizontal = createIcon('...');
export const Settings = createIcon('*');
export const SlidersHorizontal = createIcon('=');
export const X = createIcon('x');
export const Eye = createIcon('o');
export const EyeOff = createIcon('-');
