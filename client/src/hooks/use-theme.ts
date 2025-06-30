import { useContext } from 'react';
import { ThemeContext } from '@/contexts/ThemeContext';

/**
 * Custom hook for accessing and controlling theme
 * Provides dark/light mode toggle functionality for TheVideoPool
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}