import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

export default function Register() {
  const router = useRouter();
  const { setToken, setUser } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async () => {
    try {
      const res = await api.register({ email, password, name });

      await setToken(res.session_token);
      setUser(res.user);

      // 🔥 КЛЮЧОВЕ — йдемо через index
      router.replace('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Register failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

      <TextInput
        placeholder="Name"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Register</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/login')}>
        <Text style={styles.link}>Go to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20 },
  input: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    borderRadius: 6,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 6,
  },
  buttonText: { color: '#fff', textAlign: 'center' },
  link: { marginTop: 15, textAlign: 'center', color: '#2563eb' },
  error: { color: 'red', marginBottom: 10 },
});
