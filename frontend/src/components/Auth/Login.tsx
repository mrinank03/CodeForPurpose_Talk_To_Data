import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../services/api';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('datalens_token', response.data.access_token);
      localStorage.setItem('datalens_user', JSON.stringify(response.data.user));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden font-sans">
      {/* Full-screen video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="/auth-bg.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40 z-[1]" />

      {/* Content layer */}
      <div className="relative z-10 min-h-screen flex">
        {/* Left side — Branding images */}
        <div className="hidden lg:flex lg:flex-1 flex-col items-center justify-center px-12">
          <div className="relative max-w-[1000px] w-full animate-fade-in-up">
            <img
              src="/auth-visual.png"
              alt="DataLens Visual"
              className="w-full drop-shadow-2xl"
            />
            {/* Animated Eyes Overlay for Mascot */}
            <div 
              className="absolute z-10 w-[5%]"
              style={{ 
                /* ADJUST THESE VALUES to perfectly align with the mascot's face in the PNG */
                top: '68%', 
                left: '54%', 
                transform: 'translate(-50%, -50%)' 
              }}
            >
              <motion.div 
                className="flex gap-[40%] w-full"
                animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
                transition={{ duration: 2, repeat: Infinity, times: [0, 0.95, 0.97, 0.99, 1], ease: "easeInOut" }}
              >
                <div className="w-full aspect-square bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
                <div className="w-full aspect-square bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Right side — Login Form */}
        <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:pr-20 pb-24 lg:flex-none lg:w-[480px] xl:w-[540px] 2xl:w-[600px]">
          <div className="mx-auto w-full max-w-sm lg:max-w-md">
            {/* Mobile-only logo */}
            <div className="lg:hidden flex justify-center mb-8">
              <img src="/auth-branding.png" alt="DataLens" className="max-w-[280px] w-full" />
            </div>

            <div>
              <h2 className="mt-2 text-3xl font-extrabold text-white font-display drop-shadow-lg">
                Sign in to DataLens
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Welcome back! Please enter your details.
              </p>
            </div>

            <div className="mt-8">
              <div className="bg-white/10 py-8 px-6 shadow-2xl rounded-2xl border border-white/15 backdrop-blur-xl">
                <form className="space-y-6" onSubmit={handleLogin}>
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-white/80">Email address</label>
                    <div className="mt-1">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="appearance-none block w-full px-4 py-3 border border-white/15 rounded-xl shadow-sm bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent sm:text-sm transition-all backdrop-blur-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80">Password</label>
                    <div className="mt-1">
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="appearance-none block w-full px-4 py-3 border border-white/15 rounded-xl shadow-sm bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent sm:text-sm transition-all backdrop-blur-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all disabled:opacity-50 hover:shadow-purple-500/30 hover:shadow-xl active:scale-[0.98]"
                    >
                      {isLoading ? 'Signing in...' : 'Sign in'}
                    </button>
                  </div>
                </form>

                <div className="mt-8">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white/10 text-white/50 rounded-full backdrop-blur-sm">New to DataLens?</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      onClick={() => navigate('/register')}
                      className="w-full flex justify-center py-3 px-4 border border-white/15 rounded-xl shadow-sm text-sm font-medium text-white bg-white/5 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/20 transition-all backdrop-blur-sm active:scale-[0.98]"
                    >
                      Create an account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
