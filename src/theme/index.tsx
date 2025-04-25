export const colors = {
  // 주요 색상
  primary: {
    light: '#3182F6',
    default: '#1971C2',
    dark: '#1864AB',
  },
  
  // 중립 색상
  gray: {
    50: '#F9FAFB',
    100: '#F2F4F6',
    200: '#E5E8EB',
    300: '#D1D6DB',
    400: '#B0B8C1',
    500: '#8B95A1',
    600: '#6B7684',
    700: '#4E5968',
    800: '#333D4B',
    900: '#191F28',
  },
  
  // 기능 색상
  system: {
    success: '#18BE94',
    warning: '#FDA51A',
    error: '#F25656',
    info: '#3897F0',
  },
  
  // 기본 색상
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
}

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const borderRadius = {
  xs: 4,
  sm: 8, 
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
}

export const typography = {
  heading: {
    h1: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '700',
    },
    h2: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '700',
    },
    h3: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '600',
    },
    h4: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '600',
    },
    h5: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600',
    },
  },
  text: {
    xl: {
      fontSize: 18,
      lineHeight: 28,
    },
    lg: {
      fontSize: 16,
      lineHeight: 24,
    },
    md: {
      fontSize: 14,
      lineHeight: 22,
    },
    sm: {
      fontSize: 13,
      lineHeight: 20,
    },
    xs: {
      fontSize: 12,
      lineHeight: 18,
    },
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
  },
}

export const zIndex = {
  base: 0,
  elevated: 1,
  dropdown: 10,
  sticky: 100,
  overlay: 200,
  modal: 300,
  toast: 400,
}

// 애니메이션 지속 시간
export const durations = {
  short: 150,
  normal: 250,
  long: 400,
}

// 미디어 쿼리 크기
export const breakpoints = {
  phone: 0,
  tablet: 768,
  desktop: 1024,
}

// Theme export
const theme = {
  colors,
  shadows,
  spacing,
  borderRadius,
  typography,
  zIndex,
  durations,
  breakpoints,
}

export default theme;