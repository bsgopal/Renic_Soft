import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';
import { Icon } from '../components/icons.jsx';
import logo from '../assets/logo.png';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showSnackbar } = useSnackbar();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mobile.trim() || !password) {
      showSnackbar('Please enter mobile number and password', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { mobile, password });
      localStorage.setItem('renic_token', res.data.token);
      login(res.data.user, res.data.client || null);
      showSnackbar(`Welcome back, ${res.data.user.name.split(' ')[0]}!`);
      navigate('/');
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Login failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left brand panel */}
      <div className="hidden lg:flex w-[46%] relative overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-indigo-700 flex-col justify-between p-12 text-white">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-20 w-[28rem] h-[28rem] rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3.5">
          <img src={logo} alt="Renic Soft" className="w-12 h-12 rounded-2xl object-contain bg-white shadow-lg" />
          <div>
            <div className="text-xl font-bold leading-tight">Renic Soft</div>
            <div className="text-sm text-white/70">License · Quotation · Billing</div>
          </div>
        </div>

        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight">
            Enterprise software
            <br />
            management, made simple.
          </h1>
          <p className="mt-5 text-white/75 leading-relaxed max-w-md">
            Generate encrypted licenses, create professional quotations and issue clean
            Google-style invoices — all from one platform.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
            {[
              { icon: 'license', label: 'Encrypted' },
              { icon: 'quote', label: 'Quotations' },
              { icon: 'bill', label: 'Invoicing' }
            ].map((f) => (
              <div key={f.label} className="rounded-2xl bg-white/10 backdrop-blur px-4 py-3.5 text-center">
                <Icon name={f.icon} className="w-5 h-5 mx-auto mb-1.5" />
                <div className="text-xs font-medium">{f.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-sm text-white/60 space-y-1">
          <p className="flex items-center gap-2"><Icon name="store" className="w-4 h-4" /> Renic Soft Technologies</p>
          <p className="flex items-center gap-2"><Icon name="users" className="w-4 h-4" /> License · Quotation · Billing Suite</p>
          <p className="flex items-center gap-2"><Icon name="bell" className="w-4 h-4" /> Real-time expiry & payment notifications</p>
        </div>
      </div>

      {/* Right login card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <img src={logo} alt="Renic Soft" className="w-16 h-16 rounded-2xl object-contain bg-white shadow-card mb-3" />
            <h1 className="text-2xl font-semibold text-ink">Renic Soft</h1>
            <p className="text-sm text-gray-500">License · Quotation · Billing</p>
          </div>

          <div className="bg-white rounded-3xl shadow-card border border-gray-100 p-8 md:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-ink">Sign in</h2>
              <p className="text-sm text-gray-500 mt-1.5">Use your registered mobile number & password</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">Mobile Number</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icon name="users" className="w-5 h-5" />
                  </span>
                  <input
                    className="input !pl-12 !py-3"
                    inputMode="numeric"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Enter registered mobile number"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Icon name="key" className="w-5 h-5" />
                  </span>
                  <input
                    className="input !pl-12 !pr-12 !py-3"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title={showPwd ? 'Hide password' : 'Show password'}
                  >
                    <Icon name="eye" className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full !py-3 !text-[15px]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign in to Renic Soft'
                )}
              </button>
            </form>

            <div className="mt-8 rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4 text-xs text-gray-500 leading-relaxed">
              <div className="flex items-center gap-1.5 font-medium text-gray-600 mb-1.5">
                <Icon name="bell" className="w-3.5 h-3.5" /> Demo platform access
              </div>
              Mobile: <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200">9345578103</code> ·
              Password: <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200">123456</code>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            © {new Date().getFullYear()} Renic Soft Technologies · Secure Enterprise License Management
          </p>
        </div>
      </div>
    </div>
  );
}