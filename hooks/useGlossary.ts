import { useState, useCallback } from 'react';
import { getGlossaryEntry, type GlossaryEntry } from '../constants/glossary';

/**
 * Hook that manages glossary tooltip visibility state.
 * Call `showTerm(key)` to open the tooltip for a glossary term.
 * Pass `visible`, `entry`, and `dismiss` to the InfoTooltip component.
 */
export function useGlossary() {
  const [visible, setVisible] = useState(false);
  const [entry, setEntry] = useState<GlossaryEntry | null>(null);

  const showTerm = useCallback((key: string) => {
    const found = getGlossaryEntry(key);
    if (found) {
      setEntry(found);
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  return { visible, entry, showTerm, dismiss };
}
