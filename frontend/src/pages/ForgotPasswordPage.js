import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/apiClient';
import { Wrench, Mail, Key, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = request, 2 = verify
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState(''); // For development only

  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Введіть email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.requestPasswordRecovery(email);
      // In development, show the code
      if (response.data?.dev_code) {
        setDevCode(response.data.dev_code);
      }
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Помилка. Спробуйте пізніше.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!code || !newPassword || !confirmPassword) {
      setError('Заповніть всі поля');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Паролі не співпадають');
      return;
    }

    if (newPassword.length < 6) {
      setError('Пароль має бути не менше 6 символів');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.verifyPasswordRecovery({
        email,
        code,
        new_password: newPassword
      });
      setStep(3); // Success
    } catch (err) {
      setError(err.response?.data?.detail || 'Невірний код або термін дії вичерпано');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
              <Wrench className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {step === 1 && 'Відновлення пароля'}
              {step === 2 && 'Введіть код'}
              {step === 3 && 'Готово!'}
            </h1>
            <p className="text-gray-500 mt-1">
              {step === 1 && 'Введіть email для отримання коду'}
              {step === 2 && `Код надіслано на ${email}`}
              {step === 3 && 'Пароль успішно змінено'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Dev Code Notice */}
          {devCode && step === 2 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
              <strong>DEV:</strong> Ваш код: <span className="font-mono font-bold">{devCode}</span>
            </div>
          )}

          {/* Step 1: Request Code */}
          {step === 1 && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="your@email.com"
                    data-testid="recovery-email-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                data-testid="recovery-submit-button"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Надсилаю...
                  </>
                ) : (
                  'Надіслати код'
                )}
              </button>
            </form>
          )}

          {/* Step 2: Verify Code */}
          {step === 2 && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Код з email</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono text-center text-lg tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    data-testid="recovery-code-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Новий пароль</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Мінімум 6 символів"
                  data-testid="recovery-new-password-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Повторіть пароль</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Повторіть новий пароль"
                  data-testid="recovery-confirm-password-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                data-testid="recovery-verify-button"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Перевіряю...
                  </>
                ) : (
                  'Змінити пароль'
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-gray-600 py-2 text-sm hover:underline"
              >
                Надіслати код повторно
              </button>
            </form>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <p className="text-gray-600">
                Ваш пароль успішно змінено. Тепер ви можете увійти з новим паролем.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
              >
                Увійти
              </button>
            </div>
          )}

          {/* Back to Login */}
          {step !== 3 && (
            <div className="mt-6 text-center">
              <Link 
                to="/login" 
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Повернутися до входу
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
