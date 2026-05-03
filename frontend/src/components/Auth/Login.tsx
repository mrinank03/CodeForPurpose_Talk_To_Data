import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen bg-natwest-night flex font-sans">
      {/* Left side - Landing Image */}
      <div className="hidden lg:flex lg:flex-1 relative bg-[#130d26]">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/landing-bg.png')" }}
        />
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:w-[480px] xl:w-[560px] 2xl:w-[640px] bg-natwest-night border-l border-white/5 shadow-2xl z-10 relative">
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          <div>
            <h2 className="mt-6 text-3xl font-extrabold text-white font-display">
              Sign in to DataLens
            </h2>
            <p className="mt-2 text-sm text-white/50">
              Welcome back! Please enter your details.
            </p>
          </div>

          <div className="mt-8">
            <div className="bg-white/5 py-8 px-6 shadow-xl rounded-2xl border border-white/10 backdrop-blur-sm">
              <form className="space-y-6" onSubmit={handleLogin}>
                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-white/70">Email address</label>
                  <div className="mt-1">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="appearance-none block w-full px-4 py-3 border border-white/10 rounded-xl shadow-sm bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-natwest-primary focus:border-transparent sm:text-sm transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70">Password</label>
                  <div className="mt-1">
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full px-4 py-3 border border-white/10 rounded-xl shadow-sm bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-natwest-primary focus:border-transparent sm:text-sm transition-all"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-natwest-primary hover:bg-natwest-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-natwest-primary focus:ring-offset-natwest-night transition-all disabled:opacity-50"
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
                    <span className="px-4 bg-[#14121c] text-white/50 rounded-full border border-white/5">New to DataLens?</span>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => navigate('/register')}
                    className="w-full flex justify-center py-3 px-4 border border-white/10 rounded-xl shadow-sm text-sm font-medium text-white bg-white/5 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/20 transition-all"
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
  );
};
