import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSocket(userId, handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const socketRef = useRef(null);

  useEffect(() => {
    if (!userId) return undefined;
    const token = localStorage.getItem('token');
    const socket = io(window.location.origin, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join', String(userId)));
    ['dataset:processing', 'dataset:ready', 'dataset:error'].forEach((evt) => {
      socket.on(evt, (data) => handlersRef.current[evt]?.(data));
    });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [userId]);

  return socketRef;
}