import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid);
        let snap = await getDoc(docRef);
        
        if (!snap.exists()) {
          const isPsicologa = u.email === 'psicologa@madurandotalentos.com';
          const isSecretaria = u.email === 'secretaria@madurandotalentos.com';
          
          const newProfile = {
            email: u.email,
            nombre: isPsicologa ? 'Psicóloga Admin' : (isSecretaria ? 'Secretaria' : 'Usuario'),
            rol: isPsicologa ? 'admin' : (isSecretaria ? 'secretaria' : 'usuario'),
            clinicaId: 'madurando-talentos',
            createdAt: new Date().toISOString()
          };
          
          await setDoc(docRef, newProfile);
          setProfile(newProfile);
        } else {
          setProfile(snap.data());
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
