import React, { useState } from 'react';
import { Message } from '../../types/index';
import { ChartRenderer } from '../Charts/ChartRenderer';

export const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-natwest-primary flex-shrink-0 flex items-center justify-center font-bold text-white text-xs mr-3 mt-1">
          DL
        </div>
      )}
      
      <div className={`max-w-[85%] ${isUser ? 'bg-natwest-primary text-white rounded-2xl rounded-tr-sm px-5 py-3 shadow-md' : 'bg-[#150D22] border border-natwest-border rounded-xl rounded-tl-sm px-5 py-4 text-natwest-textPrimary shadow-sm'}`}>
        <div className="leading-relaxed">
          {message.content}
        </div>
        
        {!isUser && message.chart_data && message.chart_type && message.chart_type !== 'none' && (
          <div className="mt-4">
            <ChartRenderer type={message.chart_type} data={message.chart_data} />
          </div>
        )}
        
        {/* Removed Audit Trail for non-technical users */}
      </div>
    </div>
  );
};
