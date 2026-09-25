import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { APP_NAME } from '../constants';

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const auth = getAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Başarılı olursa App.tsx otomatik yönlendirir.
    } catch {
      setError("Hatalı e-posta veya şifre!");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-screen h-[100dvh] bg-surface md:bg-canvas flex items-center justify-center font-sans overflow-hidden">
      <div className="w-full h-full md:h-auto md:max-w-sm bg-surface p-8 md:rounded-[2.5rem] md:shadow-2xl md:border border-line flex flex-col justify-center">
        <div className="flex flex-col items-center mb-10">
          <img src="/logo.png" alt="" className="h-24 w-24 object-contain drop-shadow-[0_0_18px_rgba(25,112,96,0.5)] mb-4" />
          <h1 className="text-3xl font-extrabold text-primary-700 text-center leading-tight">{APP_NAME}</h1>
          <p className="text-xs text-accent-700 mt-1 uppercase tracking-widest font-bold">Yönetici Paneli</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className="text-xs font-bold text-muted ml-4 mb-1 block uppercase">E-Posta</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-canvas rounded-2xl border border-line text-ink focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
              placeholder="ornek@eposta.com"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="text-xs font-bold text-muted ml-4 mb-1 block uppercase">Şifre</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-canvas rounded-2xl border border-line text-ink focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p role="alert" className="text-rose-600 text-sm text-center font-bold bg-rose-50 py-2 rounded-xl">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary-900/40 hover:bg-primary-400 transition-transform active:scale-95 mt-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'GİRİŞ YAP'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
