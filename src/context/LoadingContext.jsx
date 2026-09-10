import { createContext, useContext, useState } from 'react';
import { Loader2 } from 'lucide-react';

const LoadingContext = createContext(null);

export function LoadingProvider({ children }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Memproses...');

  const showLoading = (text = 'Memproses...') => {
    setLoadingText(text);
    setIsLoading(true);
  };
  
  const hideLoading = () => setIsLoading(false);

  return (
    <LoadingContext.Provider value={{ isLoading, showLoading, hideLoading }}>
      {children}
      
      {/* Global Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--card)] p-6 rounded-[var(--radius-lg)] shadow-lg border border-[var(--border)] flex flex-col items-center animate-in zoom-in-95 duration-200">
            <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin mb-3" />
            <p className="text-[var(--foreground)] font-medium text-sm">{loadingText}</p>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
}

export const useGlobalLoading = () => useContext(LoadingContext);
