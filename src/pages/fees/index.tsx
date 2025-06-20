// pages/fees/index.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../utils/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { 
  DollarSign, 
  User, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  RefreshCw,
  CreditCard,
  Receipt,
  // Calendar
} from 'lucide-react';

interface Token {
  id: number;
  token_number: number;
  name: string;
  status: 'waiting' | 'assigned' | 'completed' | 'paid';
  assigned_desk_id: number | null;
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Desk {
  id: number;
  desk_number: number;
  name: string;
  operator_name: string;
}

interface TokenWithDesk extends Token {
  assigned_desk?: Desk;
}

export default function FeesPage() {
  const [completedTokens, setCompletedTokens] = useState<TokenWithDesk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingTokenId, setProcessingTokenId] = useState<number | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Auto-hide alerts after 5 seconds
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Fetch completed and paid tokens
  const fetchTokens = useCallback(async () => {
    try {
      // Fetch completed tokens (waiting for payment)
      const { data: completedData, error: completedError } = await supabase
        .from('tokens')
        .select('*')
        .eq('status', 'completed')
        .order('updated_at', { ascending: true }); // FIFO order

      if (completedError) throw completedError;

      // Fetch desk information for tokens
      const { data: desksData, error: desksError } = await supabase
        .from('desks')
        .select('*');

      if (desksError) throw desksError;

      // Process tokens with desk information
      const processedCompleted = completedData?.map(token => ({
        ...token,
        assigned_desk: token.assigned_desk_id 
          ? desksData?.find(desk => desk.id === token.assigned_desk_id)
          : null
      })) || [];

      setCompletedTokens(processedCompleted);
      setLastUpdate(new Date());

    } catch (error) {
      console.error('Error fetching tokens:', error);
      setAlert({ type: 'error', message: 'Failed to fetch tokens' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark token as paid and delete it
  const markAsPaid = async (tokenId: number, tokenNumber: number, customerName: string) => {
    if (!confirm(`Mark Token #${tokenNumber} (${customerName}) as paid and remove from system?`)) {
      return;
    }

    setProcessingTokenId(tokenId);

    try {
      // Simply delete the token from database
      // The desk counter was already incremented when the token was marked as completed
      const { error: deleteError } = await supabase
        .from('tokens')
        .delete()
        .eq('id', tokenId);

      if (deleteError) throw deleteError;

      setAlert({ 
        type: 'success', 
        message: `Token #${tokenNumber} (${customerName}) payment completed and removed from system!` 
      });

      // Refresh tokens
      await fetchTokens();

    } catch (error) {
      console.error('Error processing payment:', error);
      setAlert({ type: 'error', message: 'Failed to process payment' });
    } finally {
      setProcessingTokenId(null);
    }
  };

  // Calculate time since completion
  const getTimeSinceCompletion = (updatedAt: string) => {
    const completedTime = new Date(updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - completedTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Initial data fetch
  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTokens();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchTokens]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading fees collection...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
                <DollarSign className="h-8 w-8 text-green-600" />
                <span>Fees Collection</span>
              </h1>
              <p className="text-gray-600">Process payments for completed tokens</p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={fetchTokens}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Alert */}
        {alert && (
          <Alert className={`mb-6 ${
            alert.type === 'success' ? 'border-green-200 bg-green-50' : 
            alert.type === 'error' ? 'border-red-200 bg-red-50' : 
            'border-blue-200 bg-blue-50'
          }`}>
            {alert.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : alert.type === 'error' ? (
              <AlertCircle className="h-4 w-4 text-red-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-blue-600" />
            )}
            <AlertDescription className={
              alert.type === 'success' ? 'text-green-800' : 
              alert.type === 'error' ? 'text-red-800' : 
              'text-blue-800'
            }>
              {alert.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">{completedTokens.length}</p>
                  <p className="text-sm text-gray-600">Awaiting Payment</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">0</p>
                  <p className="text-sm text-gray-600">Paid Today</p>
                  <p className="text-xs text-gray-500">(Removed from system)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {completedTokens.length}
                  </p>
                  <p className="text-sm text-gray-600">Total Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Queue */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Payment Queue</span>
              </CardTitle>
              <CardDescription>Tokens awaiting payment collection</CardDescription>
            </CardHeader>
            <CardContent>
              {completedTokens.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Receipt className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-lg font-medium">No tokens waiting for payment</p>
                  <p className="text-sm">Completed tokens will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedTokens.map((token, index) => (
                    <div
                      key={token.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        index === 0 
                          ? 'border-orange-200 bg-orange-50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${
                            index === 0 ? 'bg-orange-100' : 'bg-gray-100'
                          }`}>
                            <User className={`h-4 w-4 ${
                              index === 0 ? 'text-orange-600' : 'text-gray-600'
                            }`} />
                          </div>
                          <div>
                            <h3 className="font-semibold">Token #{token.token_number}</h3>
                            <p className="text-sm text-gray-600">{token.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant="outline" 
                            className={
                              index === 0 
                                ? 'bg-orange-100 text-orange-800 border-orange-200' 
                                : 'bg-gray-100 text-gray-800 border-gray-200'
                            }
                          >
                            {index === 0 ? 'Next' : `Position ${index + 1}`}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        {token.assigned_desk && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <span>Served at: {token.assigned_desk.name} by {token.assigned_desk.operator_name}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Clock className="h-3 w-3" />
                          <span>Completed: {getTimeSinceCompletion(token.updated_at)}</span>
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => markAsPaid(token.id, token.token_number, token.name)}
                        disabled={processingTokenId === token.id}
                        className={`w-full ${
                          index === 0 
                            ? 'bg-green-600 hover:bg-green-700' 
                            : 'bg-gray-600 hover:bg-gray-700'
                        }`}
                      >
                        {processingTokenId === token.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark as Paid
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completed Payments Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Receipt className="h-5 w-5" />
                <span>Payment Info</span>
              </CardTitle>
              <CardDescription>Information about payment processing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Payment Process</span>
                  </div>
                  <p className="text-sm text-green-700">
                    When tokens are marked as paid, they are automatically removed from the system 
                    and the desk counter is updated.
                  </p>
                </div>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Desk Performance</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Each successful payment increments the desk&apos;s total tokens served counter 
                    for performance tracking.
                  </p>
                </div>

                {completedTokens.length === 0 && (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                    <p className="text-sm text-gray-600">
                      No payments pending. All tokens have been processed!
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Last updated: {lastUpdate.toLocaleTimeString()} | Auto-refresh every 5 seconds
          </p>
        </div>
      </div>
    </div>
  );
}