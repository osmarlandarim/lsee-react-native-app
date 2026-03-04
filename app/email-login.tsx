import { Link, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { forgotPassword, registerWithEmailPassword, resetPasswordWithCode, signInWithEmailPassword } from '@/services/auth';

export default function EmailLoginScreen() {
  const router = useRouter();
  const { session, setAuthenticatedSession } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const title = useMemo(() => {
    if (mode === 'register') {
      return 'Criar nova conta';
    }

    if (mode === 'forgot') {
      return 'Esqueci minha senha';
    }

    if (mode === 'reset') {
      return 'Redefinir senha';
    }

    return 'Entrar com email';
  }, [mode]);

  useEffect(() => {
    if (session) {
      router.replace('/');
    }
  }, [session, router]);

  async function handleSubmit() {
    const normalizedEmail = email.trim();
    setAuthFeedback(null);

    if (mode === 'forgot') {
      if (!normalizedEmail) {
        const message = 'Informe o e-mail para recuperação.';
        setAuthFeedback(message);
        Alert.alert('Campo obrigatório', message);
        return;
      }

      try {
        setIsSubmitting(true);
        const response = await forgotPassword(normalizedEmail);
        const message = response?.message ?? 'Se o e-mail existir, as instruções de recuperação serão enviadas.';
        setAuthFeedback(message);
        Alert.alert('Recuperação de senha', message);
        setMode('reset');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível iniciar a recuperação de senha.';
        setAuthFeedback(message);
        Alert.alert('Falha na recuperação', message);
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (mode === 'reset') {
      if (!normalizedEmail) {
        const message = 'Campo email é obrigatório para reset por código.';
        setAuthFeedback(message);
        Alert.alert('Campo obrigatório', message);
        return;
      }

      if (!resetCode.trim() || !newPassword.trim()) {
        const message = 'Preencha código e nova senha.';
        setAuthFeedback(message);
        Alert.alert('Campos obrigatórios', message);
        return;
      }

      const normalizedCode = resetCode.replace(/\D/g, '');

      if (normalizedCode.length !== 6) {
        const message = 'O código de recuperação deve ter 6 dígitos.';
        setAuthFeedback(message);
        Alert.alert('Código inválido', message);
        return;
      }

      if (newPassword.trim().length < 6) {
        const message = 'A nova senha deve ter pelo menos 6 caracteres.';
        setAuthFeedback(message);
        Alert.alert('Senha inválida', message);
        return;
      }

      if (newPassword !== confirmPassword) {
        const message = 'A confirmação de senha não confere.';
        setAuthFeedback(message);
        Alert.alert('Senha inválida', message);
        return;
      }

      try {
        setIsSubmitting(true);
        const response = await resetPasswordWithCode({
          email: normalizedEmail,
          code: normalizedCode,
          newPassword: newPassword.trim(),
        });
        const message = response?.message ?? 'Senha redefinida com sucesso.';
        setAuthFeedback(message);
        Alert.alert('Senha redefinida', message);
        setMode('login');
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setResetCode('');
        setTimeout(() => {
          passwordInputRef.current?.focus();
        }, 0);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível redefinir a senha.';
        setAuthFeedback(message);
        Alert.alert('Falha na redefinição', message);
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (!normalizedEmail || !password.trim()) {
      setAuthFeedback('Preencha email e senha.');
      Alert.alert('Campos obrigatórios', 'Preencha email e senha.');
      return;
    }

    if (mode === 'register' && password.trim().length < 6) {
      setAuthFeedback('A senha deve ter pelo menos 6 caracteres.');
      Alert.alert('Senha inválida', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      setIsSubmitting(true);

      const nextSession =
        mode === 'login'
          ? await signInWithEmailPassword(normalizedEmail, password)
          : await registerWithEmailPassword({
              email: normalizedEmail,
              password,
              fullName: fullName.trim() || undefined,
            });

      setAuthFeedback(mode === 'register' ? 'Conta criada com sucesso. Entrando...' : 'Login realizado com sucesso. Entrando...');
      await setAuthenticatedSession(nextSession);
      router.replace('/');
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Não foi possível concluir a autenticação.';
      const normalizedMessage = rawMessage.toLowerCase();
      const friendlyMessage = normalizedMessage.includes('credenciais inválidas')
        ? 'Credenciais inválidas. Verifique email/senha. Se sua conta era só Google, use "Criar uma nova Conta" com o mesmo e-mail para definir senha local.'
        : normalizedMessage.includes('e-mail já cadastrado')
          ? 'E-mail já cadastrado com senha local. Faça login com email/senha.'
          : rawMessage;

      if (mode === 'register' && normalizedMessage.includes('e-mail já cadastrado')) {
        setMode('login');
      }

      setAuthFeedback(friendlyMessage);
      Alert.alert('Falha na autenticação', friendlyMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (session) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>

        {mode === 'register' ? (
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            placeholder="Nome completo (opcional)"
            placeholderTextColor="#9CA3AF"
          />
        ) : null}

        {(mode === 'login' || mode === 'register' || mode === 'forgot' || mode === 'reset') ? (
          <TextInput
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (authFeedback) {
                setAuthFeedback(null);
              }
            }}
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        ) : null}

        {mode === 'reset' ? (
          <>
            <TextInput
              value={resetCode}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, '').slice(0, 6);
                setResetCode(digits);
                if (authFeedback) {
                  setAuthFeedback(null);
                }
              }}
              style={styles.input}
              placeholder="Código de recuperação (6 dígitos)"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              autoCapitalize="none"
            />
            <TextInput
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (authFeedback) {
                  setAuthFeedback(null);
                }
              }}
              style={styles.input}
              placeholder="Nova senha"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (authFeedback) {
                  setAuthFeedback(null);
                }
              }}
              style={styles.input}
              placeholder="Confirmar nova senha"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoCapitalize="none"
            />
          </>
        ) : mode !== 'forgot' ? (
          <TextInput
            ref={passwordInputRef}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (authFeedback) {
                setAuthFeedback(null);
              }
            }}
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            autoCapitalize="none"
          />
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitButtonPressed,
            isSubmitting && styles.submitButtonDisabled,
          ]}>
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              {mode === 'login'
                ? 'Entrar'
                : mode === 'register'
                  ? 'Criar conta'
                  : mode === 'forgot'
                    ? 'Enviar recuperação'
                    : 'Redefinir senha'}
            </Text>
          )}
        </Pressable>

        {mode === 'login' ? (
          <Pressable
            onPress={() => {
              setMode('register');
              setAuthFeedback(null);
            }}>
            <Text style={styles.linkText}>Criar uma nova Conta</Text>
          </Pressable>
        ) : null}

        {mode === 'login' ? (
          <Pressable
            onPress={() => {
              setMode('forgot');
              setAuthFeedback(null);
            }}>
            <Text style={styles.linkText}>Esqueci minha senha</Text>
          </Pressable>
        ) : null}

        {mode === 'forgot' ? (
          <Pressable
            onPress={() => {
              setMode('reset');
              setAuthFeedback(null);
            }}>
            <Text style={styles.linkText}>Já tenho código de recuperação</Text>
          </Pressable>
        ) : null}

        {mode !== 'login' ? (
          <Pressable
            onPress={() => {
              setMode('login');
              setAuthFeedback(null);
            }}>
            <Text style={styles.linkText}>Voltar para login</Text>
          </Pressable>
        ) : null}

        {authFeedback ? <Text style={styles.feedbackText}>{authFeedback}</Text> : null}

        {mode === 'login' ? (
          <Text style={styles.helperText}>
            Se sua conta antiga era apenas Google, use “Criar uma nova Conta” com o mesmo e-mail para criar senha local.
          </Text>
        ) : null}

        <Link href="/" style={styles.backLink}>
          Voltar
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  submitButton: {
    marginTop: 6,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  linkText: {
    marginTop: 4,
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackText: {
    marginTop: 4,
    fontSize: 13,
    color: '#B91C1C',
  },
  helperText: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  backLink: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 13,
  },
});
