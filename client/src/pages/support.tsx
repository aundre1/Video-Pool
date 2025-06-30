import React from 'react';
import { Headset } from 'lucide-react';
import { ChatInterface } from '@/components/chat/ChatInterface';

export default function Support() {
  return (
    <div className="container py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
          <Headset className="text-primary" />
          Customer Support
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Our AI assistant is here to help you with any questions or issues you might have. 
          For immediate assistance, chat with our support bot below.
        </p>
      </div>
      
      <div className="mb-10">
        <ChatInterface />
      </div>
      
      <div className="max-w-2xl mx-auto mt-16 border border-muted rounded-lg p-6 bg-muted/10">
        <h2 className="text-xl font-semibold mb-4">Common Support Topics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 bg-background rounded-md shadow-sm border border-muted">
            <h3 className="font-medium mb-2">Membership Issues</h3>
            <p className="text-sm text-muted-foreground">
              Questions about your subscription, download credits, or membership renewal.
            </p>
          </div>
          <div className="p-4 bg-background rounded-md shadow-sm border border-muted">
            <h3 className="font-medium mb-2">Account Access</h3>
            <p className="text-sm text-muted-foreground">
              Login problems, password resets, or updating account information.
            </p>
          </div>
          <div className="p-4 bg-background rounded-md shadow-sm border border-muted">
            <h3 className="font-medium mb-2">Video Downloads</h3>
            <p className="text-sm text-muted-foreground">
              Issues with downloading videos, video quality, or playback problems.
            </p>
          </div>
          <div className="p-4 bg-background rounded-md shadow-sm border border-muted">
            <h3 className="font-medium mb-2">Billing & Payments</h3>
            <p className="text-sm text-muted-foreground">
              Questions about payment methods, invoices, or subscription costs.
            </p>
          </div>
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            For urgent matters, please email us at:{" "}
            <a href="mailto:info@thevideopool.com" className="text-primary hover:underline">
              info@thevideopool.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}