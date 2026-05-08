import { useState } from '#app';

export const useToast = () => {
  const toasts = useState('system:toasts', () => []);

  const addToast = (message: string, type: 'success' | 'error' = 'success', duration = 3000) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    toasts.value.push({
      id,
      message,
      type
    });

    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id: string) => {
    toasts.value = toasts.value.filter((t: any) => t.id !== id);
  };

  return {
    toasts,
    addToast,
    removeToast
  };
};
