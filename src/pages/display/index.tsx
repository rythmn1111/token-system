// pages/display/index.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../utils/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { 
  Monitor, 
  User, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  RefreshCw
} from 'lucide-react';

interface Token {
  id: number;
  token_number: number;
  name: string;
  status: 'waiting' | 'assigned' | 'completed' | 'cancelled';
  assigned_desk_id: number | null;
  assigned_at: string | null;
  created_at: string;
}

interface Desk {
  id: number;
  desk_number: number;
  name: string;
  status: 'free' | 'occupied' | 'maintenance';
  assigned_token_id: number | null;
  assigned_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface TokenWithDesk extends Token {
  assigned_desk?: Desk;
}

interface DeskWithToken extends Desk {
  assigned_token?: Token;
}

interface SystemSettings {
  auto_assign_enabled: boolean;
}

export default function DisplayPage() {
  const [desks, setDesks] = useState<DeskWithToken[]>([]);
  const [waitingTokens, setWaitingTokens] = useState<Token[]>([]);
  const [assignedTokens, setAssignedTokens] = useState<TokenWithDesk[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Auto-hide alerts after 5 seconds
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      // Fetch all desks first
      const { data: desksData, error: desksError } = await supabase
        .from('desks')
        .select('*')
        .eq('is_active', true)
        .order('desk_number', { ascending: true });

      if (desksError) throw desksError;

      // Fetch all tokens
      const { data: tokensData, error: tokensError } = await supabase
        .from('tokens')
        .select('*')
        .order('token_number', { ascending: true });

      if (tokensError) throw tokensError;

      // Fetch system settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('system_settings')
        .select('auto_assign_enabled')
        .eq('id', 1)
        .single();

      if (settingsError) throw settingsError;

      // Process the data to create relationships manually
      const processedDesks = desksData?.map(desk => ({
        ...desk,
        assigned_token: desk.assigned_token_id 
          ? tokensData?.find(token => token.id === desk.assigned_token_id)
          : null
      })) || [];

      const waitingTokensData = tokensData?.filter(token => token.status === 'waiting') || [];
      
      const assignedTokensData = tokensData?.filter(token => token.status === 'assigned').map(token => ({
        ...token,
        assigned_desk: token.assigned_desk_id 
          ? desksData?.find(desk => desk.id === token.assigned_desk_id)
          : null
      })) || [];

      setDesks(processedDesks);
      setWaitingTokens(waitingTokensData);
      setAssignedTokens(assignedTokensData);
      setSystemSettings(settingsData);
      setLastUpdate(new Date());

    } catch (error) {
      console.error('Error fetching data:', error);
      setAlert({ type: 'error', message: 'Failed to fetch data' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto assignment algorithm
  const performAutoAssignment = useCallback(async () => {
    if (!systemSettings?.auto_assign_enabled || waitingTokens.length === 0) return;

    try {
      // Find the first waiting token (FIFO)
      const nextToken = waitingTokens[0];
      
      // Find the first free desk
      const freeDesk = desks.find(desk => desk.status === 'free' && desk.is_active);
      
      if (!freeDesk) return; // No free desks available

      // Update token status
      const { error: tokenError } = await supabase
        .from('tokens')
        .update({
          status: 'assigned',
          assigned_desk_id: freeDesk.id,
          assigned_at: new Date().toISOString()
        })
        .eq('id', nextToken.id);

      if (tokenError) throw tokenError;

      // Update desk status
      const { error: deskError } = await supabase
        .from('desks')
        .update({
          status: 'occupied',
          assigned_token_id: nextToken.id,
          assigned_at: new Date().toISOString()
        })
        .eq('id', freeDesk.id);

      if (deskError) throw deskError;

      // Show success message
      setAlert({
        type: 'success',
        message: `Token #${nextToken.token_number} (${nextToken.name}) assigned to ${freeDesk.name}`
      });

      // Refresh data after assignment
      await fetchData();

    } catch (error) {
      console.error('Error in auto assignment:', error);
      setAlert({ type: 'error', message: 'Failed to assign token automatically' });
    }
  }, [waitingTokens, desks, systemSettings, fetchData]);

  // Mark token as completed and free up the desk
  const completeToken = async (tokenId: number, deskId: number) => {
    try {
      // Update token status to completed
      const { error: tokenError } = await supabase
        .from('tokens')
        .update({
          status: 'completed'
        })
        .eq('id', tokenId);

      if (tokenError) throw tokenError;

      // Free up the desk
      const { error: deskError } = await supabase
        .from('desks')
        .update({
          status: 'free',
          assigned_token_id: null,
          assigned_at: null
        })
        .eq('id', deskId);

      if (deskError) throw deskError;

      setAlert({ type: 'success', message: 'Token completed and desk freed up' });
      await fetchData();

    } catch (error) {
      console.error('Error completing token:', error);
      setAlert({ type: 'error', message: 'Failed to complete token' });
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling for auto-assignment every 3 seconds
  useEffect(() => {
    if (!systemSettings?.auto_assign_enabled) return;

    const interval = setInterval(() => {
      performAutoAssignment();
    }, 3000);

    return () => clearInterval(interval);
  }, [performAutoAssignment, systemSettings?.auto_assign_enabled]);

  // Refresh data every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading display...</span>
        </div>
      </div>
    );
  }

  const freeDesks = desks.filter(desk => desk.status === 'free').length;
  const occupiedDesks = desks.filter(desk => desk.status === 'occupied').length;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Token Display Board</h1>
              <p className="text-gray-600">Real-time token assignment and desk status</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  systemSettings?.auto_assign_enabled ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm font-medium">
                  Auto-Assign: {systemSettings?.auto_assign_enabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <Button
                onClick={fetchData}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{waitingTokens.length}</p>
                  <p className="text-sm text-gray-600">Waiting Tokens</p>
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
                  <p className="text-2xl font-bold text-green-600">{freeDesks}</p>
                  <p className="text-sm text-gray-600">Free Desks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Monitor className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">{occupiedDesks}</p>
                  <p className="text-sm text-gray-600">Occupied Desks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <User className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{assignedTokens.length}</p>
                  <p className="text-sm text-gray-600">Assigned Tokens</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Desk Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="h-5 w-5" />
                <span>Desk Status</span>
              </CardTitle>
              <CardDescription>Real-time desk availability and assignments</CardDescription>
            </CardHeader>
            <CardContent>
              {desks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No desks available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {desks.map((desk) => (
                    <div
                      key={desk.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        desk.status === 'free' 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-orange-200 bg-orange-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${
                            desk.status === 'free' ? 'bg-green-100' : 'bg-orange-100'
                          }`}>
                            <Monitor className={`h-4 w-4 ${
                              desk.status === 'free' ? 'text-green-600' : 'text-orange-600'
                            }`} />
                          </div>
                          <div>
                            <h3 className="font-semibold">{desk.name}</h3>
                            <p className="text-sm text-gray-600">Desk #{desk.desk_number}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={desk.status === 'free' ? 'default' : 'secondary'}
                            className={
                              desk.status === 'free' 
                                ? 'bg-green-100 text-green-800 border-green-200' 
                                : 'bg-orange-100 text-orange-800 border-orange-200'
                            }
                          >
                            {desk.status === 'free' ? 'Available' : 'Occupied'}
                          </Badge>
                        </div>
                      </div>
                      
                      {desk.assigned_token && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">
                                Token #{desk.assigned_token.token_number} - {desk.assigned_token.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                Assigned: {new Date(desk.assigned_at!).toLocaleTimeString()}
                              </p>
                            </div>
                            <Button
                              onClick={() => completeToken(desk.assigned_token!.id, desk.id)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Complete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Token Queue */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Token Queue</span>
              </CardTitle>
              <CardDescription>Waiting tokens and current assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Waiting Tokens */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Waiting Queue</h3>
                  {waitingTokens.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                      <p>No tokens waiting</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {waitingTokens.slice(0, 5).map((token, index) => (
                        <div
                          key={token.id}
                          className={`p-3 rounded-lg border ${
                            index === 0 
                              ? 'border-blue-200 bg-blue-50' 
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Token #{token.token_number}</p>
                              <p className="text-sm text-gray-600">{token.name}</p>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="text-blue-600 border-blue-200">
                                {index === 0 ? 'Next' : `Position ${index + 1}`}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                      {waitingTokens.length > 5 && (
                        <div className="text-center py-2 text-sm text-gray-500">
                          +{waitingTokens.length - 5} more tokens waiting...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Last updated: {lastUpdate.toLocaleTimeString()} | 
            Auto-assignment: {systemSettings?.auto_assign_enabled ? 'Enabled' : 'Disabled'} | 
            Auto-refresh every 5 seconds
          </p>
        </div>
      </div>
    </div>
  );
}