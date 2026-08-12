import { useState, useEffect } from 'react';
import { onAuthStateChanged } from '../services/mockApi';

export function useAuthStatus() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((user) => {
      if (user) {
        setLoggedIn(true);
      } else {
        setLoggedIn(false);
      }
      setCheckingStatus(false);
    });

    return () => unsubscribe();
  }, []);

  return { loggedIn, checkingStatus };
}
