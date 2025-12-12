import React from 'react';
import { CSVUploader } from '../components/CSVUploader';
import { ShieldCheck, Lock, EyeOff } from 'lucide-react';

interface UploadPageProps {
  onUploadComplete: () => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({ onUploadComplete }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in duration-500">
            <div className="space-y-4 max-w-3xl">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                    The <span className="text-accent">Free & Private</span> Way to Master Your Money
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                    MoneyMind categorizes your transactions anonymously using AI.
                    <span className="block mt-2 text-gray-500 text-base">
                        <span className="font-medium text-gray-700">No signup. No server storage.</span> Your data never leaves your browser, 
                        and your API keys are <span className="font-medium text-gray-700">encrypted & stored locally</span>.
                    </span>
                </p>
            </div>
            <CSVUploader onUploadComplete={onUploadComplete} />
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-12 w-full max-w-4xl text-left">
                <div className="p-5 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-3">
                        <ShieldCheck className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="font-semibold text-gray-900">100% Client-Side</h3>
                    <p className="text-sm text-gray-500 mt-1">We don't have a backend database. Your bank statement is processed entirely within your browser.</p>
                </div>
                <div className="p-5 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
                        <Lock className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Secure & Encrypted</h3>
                    <p className="text-sm text-gray-500 mt-1">API keys are encrypted in LocalStorage. Use cloud AI securely or run completely local models.</p>
                </div>
                <div className="p-5 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
                        <EyeOff className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Anonymous</h3>
                    <p className="text-sm text-gray-500 mt-1">We don't ask for your name, email, or account numbers. Just pure financial analysis.</p>
                </div>
            </div>
        </div>
    );
};