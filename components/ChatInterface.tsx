import React, { useRef, useEffect, useState } from 'react';
import { useP2PChat } from '../hooks/useP2PChat';

export const ChatInterface: React.FC = () => {
  const { messages, peerState, sendMessage } = useP2PChat();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputText.trim()) {
      sendMessage(inputText);
      setInputText('');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard! Share it with a friend.');
  };

  const handleNewRoom = () => {
    window.location.hash = '';
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#bca5e8] px-4 font-nunito">
      {/* Title */}
      <h1 className="text-4xl md:text-5xl text-white mb-8 font-cursive drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)] tracking-wide">
        Our Safe Space
      </h1>

      {/* Main Card */}
      <div className="w-full max-w-sm md:max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col h-[600px] max-h-[80vh]">
        
        {/* Status Bar / Header inside card */}
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center text-xs text-gray-500">
          <span className={`${peerState.status === 'ready' ? 'text-green-500' : peerState.status === 'error' ? 'text-red-500' : 'text-orange-500'} flex items-center gap-1`}>
            <span className={`block w-2 h-2 rounded-full ${peerState.status === 'ready' ? 'bg-green-500' : peerState.status === 'error' ? 'bg-red-500' : 'bg-orange-500'}`}></span>
            {peerState.status === 'ready' 
              ? (peerState.connections.length > 0 ? `${peerState.connections.length} Online` : 'Waiting for friends...') 
              : peerState.status === 'error' 
                ? 'Connection Failed' 
                : 'Connecting...'}
          </span>
          <button onClick={handleCopyLink} className="hover:text-purple-600 transition-colors">
            Copy Link
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white scrollbar-hide">
          {peerState.status === 'error' ? (
             <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <p className="text-red-400 mb-2">Could not connect to the room.</p>
                <button 
                  onClick={handleNewRoom}
                  className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm hover:bg-purple-200 transition"
                >
                  Start New Room
                </button>
             </div>
          ) : messages.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-300 text-center p-4">
                <p>No messages yet.</p>
                <p className="text-sm mt-2">Share the link to start chatting!</p>
             </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex w-full ${msg.isSelf ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm break-words ${
                    msg.isSelf
                      ? 'bg-purple-100 text-purple-900 rounded-br-none'
                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-[#f0f0f0] p-4 border-t border-gray-200">
          <form 
            onSubmit={handleSend}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="huh" 
              disabled={peerState.status !== 'ready'}
              className="flex-1 px-4 py-3 rounded-full border border-gray-300 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200 bg-white text-gray-700 shadow-sm disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || peerState.status !== 'ready'}
              className="bg-[#9F7AEA] hover:bg-[#805ad5] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-full shadow-md transition-all duration-200 ease-in-out transform active:scale-95"
            >
              Send
            </button>
          </form>
        </div>
      </div>
      
      {/* Footer / Instructions */}
      <div className="mt-6 text-center text-white/80 text-sm">
        <p>Your messages are P2P encrypted and not stored on any server.</p>
      </div>
    </div>
  );
};