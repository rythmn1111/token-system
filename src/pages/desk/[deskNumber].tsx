// pages/desk/[deskNumber].tsx
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  // RefreshCw,
  ArrowLeft,
  Calendar,
  Timer
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
  operator_name: string;
  total_tokens_served: number;
  status: 'free' | 'occupied' | 'maintenance';
  assigned_token_id: number | null;
  assigned_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface DeskWithToken extends Desk {
  assigned_token?: Token;
}

export default function DeskPage() {
  const router = useRouter();
  const { deskNumber } = router.query;
  
  const [desk, setDesk] = useState<DeskWithToken | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
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

  // Fetch desk data
  const fetchDeskData = useCallback(async () => {
    if (!deskNumber) return;

    try {
      setIsLoading(true);

      // Fetch desk by desk number
      const { data: deskData, error: deskError } = await supabase
        .from('desks')
        .select('*')
        .eq('desk_number', parseInt(deskNumber as string))
        .single();

      if (deskError) {
        if (deskError.code === 'PGRST116') {
          // Desk not found
          setAlert({ type: 'error', message: `Desk ${deskNumber} not found` });
          setDesk(null);
          return;
        }
        throw deskError;
      }

      // If desk has an assigned token, fetch token details
      let assignedToken = null;
      if (deskData.assigned_token_id) {
        const { data: tokenData, error: tokenError } = await supabase
          .from('tokens')
          .select('*')
          .eq('id', deskData.assigned_token_id)
          .single();

        if (tokenError) throw tokenError;
        assignedToken = tokenData;
      }

      setDesk({
        ...deskData,
        assigned_token: assignedToken
      });
      setLastUpdate(new Date());

    } catch (error) {
      console.error('Error fetching desk data:', error);
      setAlert({ type: 'error', message: 'Failed to fetch desk information' });
    } finally {
      setIsLoading(false);
    }
  }, [deskNumber]);

  // Complete token and free up desk
  const completeToken = async () => {
    if (!desk || !desk.assigned_token) return;

    setIsCompleting(true);

    try {
      // Update token status to completed
      const { error: tokenError } = await supabase
        .from('tokens')
        .update({
          status: 'completed'
        })
        .eq('id', desk.assigned_token.id);

      if (tokenError) throw tokenError;

      // Get current desk data to increment counter
      const { data: currentDeskData, error: deskFetchError } = await supabase
        .from('desks')
        .select('total_tokens_served')
        .eq('id', desk.id)
        .single();

      if (deskFetchError) throw deskFetchError;

      // Free up the desk and increment the counter
      const { error: deskError } = await supabase
        .from('desks')
        .update({
          status: 'free',
          assigned_token_id: null,
          assigned_at: null,
          total_tokens_served: currentDeskData.total_tokens_served + 1
        })
        .eq('id', desk.id);

      if (deskError) throw deskError;

      setAlert({ 
        type: 'success', 
        message: `Token #${desk.assigned_token.token_number} completed successfully! Counter updated.` 
      });

      // Refresh desk data
      await fetchDeskData();

    } catch (error) {
      console.error('Error completing token:', error);
      setAlert({ type: 'error', message: 'Failed to complete token' });
    } finally {
      setIsCompleting(false);
    }
  };

  // Calculate time elapsed since assignment
  const getTimeElapsed = (assignedAt: string) => {
    const assignedTime = new Date(assignedAt);
    const now = new Date();
    const diffMs = now.getTime() - assignedTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  };

  // Initial data fetch
  useEffect(() => {
    fetchDeskData();
  }, [deskNumber]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDeskData();
    }, 10000);

    return () => clearInterval(interval);
  }, [deskNumber]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading desk information...</span>
        </div>
      </div>
    );
  }

  if (!desk) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="mb-4">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Desk Not Found</h2>
            <p className="text-gray-600 mb-4">Desk {deskNumber} doesn&apos;t exist or is not active.</p>
            <Button onClick={() => router.push('/display')} className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Display</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                onClick={() => router.push('/display')} 
                variant="outline" 
                size="sm"
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
                  <Monitor className="h-8 w-8 text-blue-600" />
                  <span>{desk.name}</span>
                </h1>
                <p className="text-gray-600">
                  Desk #{desk.desk_number} | Operator: {desk.operator_name}
                </p>
                <p className="text-sm text-gray-500">
                  Total Tokens Served: {desk.total_tokens_served}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge 
                variant={desk.status === 'free' ? 'default' : 'secondary'}
                className={`text-sm px-3 py-1 ${
                  desk.status === 'free' 
                    ? 'bg-green-100 text-green-800 border-green-200' 
                    : desk.status === 'occupied'
                    ? 'bg-orange-100 text-orange-800 border-orange-200'
                    : 'bg-gray-100 text-gray-800 border-gray-200'
                }`}
              >
                {desk.status === 'free' ? 'Available' : 
                 desk.status === 'occupied' ? 'Occupied' : 'Maintenance'}
              </Badge>
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

        {/* Main Content */}
        {desk.status === 'free' ? (
          /* Free Desk State */
          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="p-8 text-center">
              <div className="mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-green-800 mb-2">Desk Available</h2>
                <p className="text-green-700">This desk is currently free and ready for the next customer.</p>
              </div>
              
              {/* Desk Info when Free */}
              <div className="bg-white rounded-lg p-6 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 mb-1">Desk Number</p>
                    <p className="text-xl font-bold text-blue-800">#{desk.desk_number}</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600 mb-1">Operator</p>
                    <p className="text-lg font-bold text-green-800">{desk.operator_name}</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-600 mb-1">Tokens Served</p>
                    <p className="text-xl font-bold text-purple-800">{desk.total_tokens_served}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 text-gray-600">
                <p className="text-sm">Waiting for automatic token assignment...</p>
                <div className="flex items-center justify-center mt-2 space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Auto-refresh active</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : desk.assigned_token ? (
          /* Occupied Desk State */
          <div className="space-y-6">
            {/* Token Information Card */}
            <Card className="border-2 border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-3 text-orange-800">
                  <User className="h-6 w-6" />
                  <span>Current Token</span>
                </CardTitle>
                <CardDescription className="text-orange-700">
                  Token currently being served at this desk
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        Token #{desk.assigned_token.token_number}
                      </h3>
                      <p className="text-lg text-gray-700 mb-4">
                        Customer: <span className="font-semibold">{desk.assigned_token.name}</span>
                      </p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>Token Created: {new Date(desk.assigned_token.created_at).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Clock className="h-4 w-4" />
                          <span>Assigned: {new Date(desk.assigned_at!).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-orange-700 font-medium">
                          <Timer className="h-4 w-4" />
                          <span>Service Time: {getTimeElapsed(desk.assigned_at!)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col justify-center">
                      <Button
                        onClick={completeToken}
                        disabled={isCompleting}
                        size="lg"
                        className="bg-green-600 hover:bg-green-700 text-white py-4 text-lg"
                      >
                        {isCompleting ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Completing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-5 w-5" />
                            Mark as Complete
                          </>
                        )}
                      </Button>
                      
                      <p className="text-sm text-gray-500 mt-2 text-center">
                        Click when service is finished
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-3">
                  <Monitor className="h-5 w-5" />
                  <span>Desk Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 mb-1">Desk Number</p>
                    <p className="text-2xl font-bold text-blue-800">#{desk.desk_number}</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-orange-600 mb-1">Current Status</p>
                    <p className="text-lg font-bold text-orange-800">Occupied</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600 mb-1">Operator</p>
                    <p className="text-lg font-bold text-green-800">{desk.operator_name}</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-600 mb-1">Tokens Served</p>
                    <p className="text-2xl font-bold text-purple-800">{desk.total_tokens_served}</p>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 text-center">
                    Last Updated: {lastUpdate.toLocaleTimeString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Maintenance or Error State */
          <Card className="border-2 border-gray-200 bg-gray-50">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-10 w-10 text-gray-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">Desk Unavailable</h2>
              <p className="text-gray-600">This desk is currently under maintenance or unavailable.</p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Auto-refresh every 10 seconds | Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}