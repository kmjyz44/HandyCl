import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/apiClient';
import { 
  MessageSquare, Send, User, ChevronLeft, X, Clock, Check, CheckCheck
} from 'lucide-react';

// Chat Panel Component
export function ChatPanel({ isOpen, onClose, currentUser }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const pollInterval = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
      // Poll for new messages every 5 seconds
      pollInterval.current = setInterval(() => {
        if (selectedConversation) {
          loadMessages(selectedConversation.user.user_id, false);
        } else {
          loadConversations(false);
        }
      }, 5000);
    }
    
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [isOpen, selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await api.getConversations();
      setConversations(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const loadMessages = async (userId, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await api.getConversationMessages(userId);
      setMessages(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const selectConversation = (conv) => {
    setSelectedConversation(conv);
    loadMessages(conv.user.user_id);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;
    
    setSending(true);
    try {
      await api.sendMessage({
        to_user_id: selectedConversation.user.user_id,
        text: newMessage.trim()
      });
      setNewMessage('');
      await loadMessages(selectedConversation.user.user_id, false);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Не вдалося відправити повідомлення');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Сьогодні';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчора';
    }
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-white">
          {selectedConversation ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                {selectedConversation.user.picture ? (
                  <img 
                    src={selectedConversation.user.picture} 
                    alt={selectedConversation.user.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-green-600" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{selectedConversation.user.name}</h3>
                <p className="text-xs text-gray-500">
                  {selectedConversation.user.role === 'provider' ? 'Виконавець' : 'Клієнт'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-green-600" />
              <h3 className="font-semibold text-gray-900">Повідомлення</h3>
            </div>
          )}
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : selectedConversation ? (
          // Chat View
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Почніть розмову</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOwn = msg.from_user_id === currentUser?.user_id;
                  const showDate = idx === 0 || 
                    formatDate(messages[idx - 1].created_at) !== formatDate(msg.created_at);
                  
                  return (
                    <React.Fragment key={msg.message_id}>
                      {showDate && (
                        <div className="text-center">
                          <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          isOwn 
                            ? 'bg-green-600 text-white rounded-br-sm' 
                            : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                        }`}>
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          <div className={`flex items-center gap-1 justify-end mt-1 ${
                            isOwn ? 'text-green-200' : 'text-gray-400'
                          }`}>
                            <span className="text-xs">{formatTime(msg.created_at)}</span>
                            {isOwn && (
                              msg.read 
                                ? <CheckCheck className="w-3 h-3" />
                                : <Check className="w-3 h-3" />
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Напишіть повідомлення..."
                  className="flex-1 px-4 py-3 border rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="p-3 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          // Conversations List
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Немає повідомлень</p>
                <p className="text-sm mt-1">Ваші розмови з'являться тут</p>
              </div>
            ) : (
              <div className="divide-y">
                {conversations.map(conv => (
                  <button
                    key={conv.user.user_id}
                    onClick={() => selectConversation(conv)}
                    className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="relative">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        {conv.user.picture ? (
                          <img 
                            src={conv.user.picture} 
                            alt={conv.user.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <User className="w-6 h-6 text-green-600" />
                        )}
                      </div>
                      {conv.unread_count > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-xs text-white font-medium">{conv.unread_count}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 truncate">{conv.user.name}</h4>
                        <span className="text-xs text-gray-500">
                          {formatTime(conv.last_message.created_at)}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                        {conv.last_message.from_user_id === currentUser?.user_id ? 'Ви: ' : ''}
                        {conv.last_message.text}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPanel;
