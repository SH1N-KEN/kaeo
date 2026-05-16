import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kaeo-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    console.log('ThemeToggle: Applying theme:', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kaeo-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kaeo-theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      console.log('ThemeToggle: Manual toggle to:', next);
      return next;
    });
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-muted transition-colors flex items-center justify-center"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 text-muted-foreground" />
      ) : (
        <Sun className="w-5 h-5 text-muted-foreground" />
      )}
    </button>
  );
};

export default ThemeToggle;
