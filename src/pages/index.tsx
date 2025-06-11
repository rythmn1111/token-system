// pages/admin/tokens.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, RotateCcw, CheckCircle, AlertCircle, MonitorSpeaker, Trash2 } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface Token {
  id: number;
  token_number: number;
  name: string;
  created_at: string;
}

interface TokenCounter {
  last_token_number: number;
}

interface Desk {
  id: number;
  desk_number: number;
  name: string;
  operator_name: string;
  total_tokens_served: number;
  is_active: boolean;
  created_at: string;
}

interface DeskCounter {
  last_desk_number: number;
}

export default function AdminTokenPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeskDialogOpen, setIsDeskDialogOpen] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isAddingDesk, setIsAddingDesk] = useState(false);
  const [isResettingDesks, setIsResettingDesks] = useState(false);
  const [deletingDeskId, setDeletingDeskId] = useState<number | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [tokenCounter, setTokenCounter] = useState<TokenCounter | null>(null);
  const [deskCounter, setDeskCounter] = useState<DeskCounter | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch tokens and counter on component mount
  useEffect(() => {
    fetchTokens();
    fetchTokenCounter();
    fetchDesks();
    fetchDeskCounter();
  }, []);

  // Auto-hide alerts after 5 seconds
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  const fetchTokens = async () => {
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('*')
        .order('token_number', { ascending: true });

      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      setAlert({ type: 'error', message: 'Failed to fetch tokens' });
    }
  };

  const fetchTokenCounter = async () => {
    try {
      const { data, error } = await supabase
        .from('token_counter')
        .select('last_token_number')
        .eq('id', 1)
        .single();

      if (error) throw error;
      setTokenCounter(data);
    } catch (error) {
      console.error('Error fetching token counter:', error);
      setAlert({ type: 'error', message: 'Failed to fetch token counter' });
    }
  };

  const fetchDesks = async () => {
    try {
      const { data, error } = await supabase
        .from('desks')
        .select('*')
        .order('desk_number', { ascending: true });

      if (error) throw error;
      setDesks(data || []);
    } catch (error) {
      console.error('Error fetching desks:', error);
      setAlert({ type: 'error', message: 'Failed to fetch desks' });
    }
  };

  const fetchDeskCounter = async () => {
    try {
      const { data, error } = await supabase
        .from('desk_counter')
        .select('last_desk_number')
        .eq('id', 1)
        .single();

      if (error) throw error;
      setDeskCounter(data);
    } catch (error) {
      console.error('Error fetching desk counter:', error);
      setAlert({ type: 'error', message: 'Failed to fetch desk counter' });
    } finally {
      setIsLoading(false);
    }
  };

  const createToken = async () => {
    if (!tokenName.trim()) {
      setAlert({ type: 'error', message: 'Please enter a token name' });
      return;
    }

    setIsCreating(true);

    try {
      // First, get and increment the counter
      const { data: counterData, error: counterError } = await supabase
        .from('token_counter')
        .select('last_token_number')
        .eq('id', 1)
        .single();

      if (counterError) throw counterError;

      const nextTokenNumber = counterData.last_token_number + 1;

      // Update the counter
      const { error: updateCounterError } = await supabase
        .from('token_counter')
        .update({ 
          last_token_number: nextTokenNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (updateCounterError) throw updateCounterError;

      // Create the token
      const { data: tokenData, error: tokenError } = await supabase
        .from('tokens')
        .insert({
          token_number: nextTokenNumber,
          name: tokenName.trim(),
        })
        .select()
        .single();

      if (tokenError) throw tokenError;

      // Update local state
      setTokens(prev => [...prev, tokenData]);
      setTokenCounter({ last_token_number: nextTokenNumber });
      setTokenName('');
      setIsCreateDialogOpen(false);
      setAlert({ 
        type: 'success', 
        message: `Token #${nextTokenNumber} created successfully for "${tokenName.trim()}"` 
      });

    } catch (error) {
      console.error('Error creating token:', error);
      setAlert({ type: 'error', message: 'Failed to create token' });
    } finally {
      setIsCreating(false);
    }
  };

  const resetTokenCounter = async () => {
    if (!confirm('Are you sure you want to reset the token counter? This will set the counter back to 0.')) {
      return;
    }

    setIsResetting(true);

    try {
      // Reset the counter to 0
      const { error: resetError } = await supabase
        .from('token_counter')
        .update({ 
          last_token_number: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (resetError) throw resetError;

      // Update local state
      setTokenCounter({ last_token_number: 0 });
      setAlert({ type: 'success', message: 'Token counter has been reset to 0' });

    } catch (error) {
      console.error('Error resetting token counter:', error);
      setAlert({ type: 'error', message: 'Failed to reset token counter' });
    } finally {
      setIsResetting(false);
    }
  };

  const addDesk = async () => {
    if (!operatorName.trim()) {
      setAlert({ type: 'error', message: 'Please enter an operator name' });
      return;
    }

    setIsAddingDesk(true);

    try {
      // First, get and increment the desk counter
      const { data: counterData, error: counterError } = await supabase
        .from('desk_counter')
        .select('last_desk_number')
        .eq('id', 1)
        .single();

      if (counterError) throw counterError;

      const nextDeskNumber = counterData.last_desk_number + 1;

      // Update the counter
      const { error: updateCounterError } = await supabase
        .from('desk_counter')
        .update({ 
          last_desk_number: nextDeskNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (updateCounterError) throw updateCounterError;

      // Create the desk
      const { data: deskData, error: deskError } = await supabase
        .from('desks')
        .insert({
          desk_number: nextDeskNumber,
          name: `Desk ${nextDeskNumber}`,
          operator_name: operatorName.trim(),
          total_tokens_served: 0,
          is_active: true,
        })
        .select()
        .single();

      if (deskError) throw deskError;

      // Update local state
      setDesks(prev => [...prev, deskData]);
      setDeskCounter({ last_desk_number: nextDeskNumber });
      setOperatorName('');
      setIsDeskDialogOpen(false);
      setAlert({ 
        type: 'success', 
        message: `Desk ${nextDeskNumber} created successfully with operator "${operatorName.trim()}"` 
      });

    } catch (error) {
      console.error('Error creating desk:', error);
      setAlert({ type: 'error', message: 'Failed to create desk' });
    } finally {
      setIsAddingDesk(false);
    }
  };

  const resetDesks = async () => {
    if (!confirm('Are you sure you want to reset all desks? This will delete all existing desks and reset the counter to 0.')) {
      return;
    }

    setIsResettingDesks(true);

    try {
      // Delete all desks
      const { error: deleteError } = await supabase
        .from('desks')
        .delete()
        .neq('id', 0); // Delete all rows

      if (deleteError) throw deleteError;

      // Reset the counter to 0
      const { error: resetError } = await supabase
        .from('desk_counter')
        .update({ 
          last_desk_number: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (resetError) throw resetError;

      // Update local state
      setDesks([]);
      setDeskCounter({ last_desk_number: 0 });
      setAlert({ type: 'success', message: 'All desks have been reset' });

    } catch (error) {
      console.error('Error resetting desks:', error);
      setAlert({ type: 'error', message: 'Failed to reset desks' });
    } finally {
      setIsResettingDesks(false);
    }
  };

  const deleteDesk = async (deskId: number, deskNumber: number, deskName: string) => {
    if (!confirm(`Are you sure you want to delete ${deskName}? This action cannot be undone.`)) {
      return;
    }

    setDeletingDeskId(deskId);

    try {
      // Delete the specific desk
      const { error: deleteError } = await supabase
        .from('desks')
        .delete()
        .eq('id', deskId);

      if (deleteError) throw deleteError;

      // Update local state
      setDesks(prev => prev.filter(desk => desk.id !== deskId));
      setAlert({ 
        type: 'success', 
        message: `${deskName} has been deleted successfully` 
      });

    } catch (error) {
      console.error('Error deleting desk:', error);
      setAlert({ type: 'error', message: `Failed to delete ${deskName}` });
    } finally {
      setDeletingDeskId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Token Management Admin</h1>
          <p className="text-gray-600">Create and manage tokens for your system</p>
        </div>

        {/* Alert */}
        {alert && (
          <Alert className={`mb-6 ${alert.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            {alert.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={alert.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {alert.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>System Statistics</CardTitle>
            <CardDescription>Current token and desk system status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Token Stats */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Token Management</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-xl font-bold text-blue-600">
                      {tokenCounter?.last_token_number || 0}
                    </div>
                    <div className="text-xs text-blue-600">Last Token</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xl font-bold text-green-600">{tokens.length}</div>
                    <div className="text-xs text-green-600">Total Tokens</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-xl font-bold text-purple-600">
                      {tokenCounter ? tokenCounter.last_token_number + 1 : 1}
                    </div>
                    <div className="text-xs text-purple-600">Next Token</div>
                  </div>
                </div>
              </div>

              {/* Desk Stats */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Desk Management</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="text-xl font-bold text-orange-600">
                      {deskCounter?.last_desk_number || 0}
                    </div>
                    <div className="text-xs text-orange-600">Last Desk</div>
                  </div>
                  <div className="text-center p-3 bg-teal-50 rounded-lg">
                    <div className="text-xl font-bold text-teal-600">{desks.length}</div>
                    <div className="text-xs text-teal-600">Total Desks</div>
                  </div>
                  <div className="text-center p-3 bg-indigo-50 rounded-lg">
                    <div className="text-xl font-bold text-indigo-600">
                      {deskCounter ? deskCounter.last_desk_number + 1 : 1}
                    </div>
                    <div className="text-xs text-indigo-600">Next Desk</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Token Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Token Actions</CardTitle>
              <CardDescription>Manage tokens and token counter</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="flex items-center space-x-2 flex-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Token</span>
                </Button>
                
                <Button 
                  onClick={resetTokenCounter}
                  variant="destructive"
                  disabled={isResetting}
                  className="flex items-center space-x-2 flex-1"
                >
                  {isResetting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  <span>{isResetting ? 'Resetting...' : 'Reset Counter'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Desk Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Desk Actions</CardTitle>
              <CardDescription>Manage desks and desk counter</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={() => setIsDeskDialogOpen(true)}
                  disabled={isAddingDesk}
                  className="flex items-center space-x-2 flex-1"
                  variant="outline"
                >
                  <MonitorSpeaker className="h-4 w-4" />
                  <span>Add Desk</span>
                </Button>
                
                <Button 
                  onClick={resetDesks}
                  variant="destructive"
                  disabled={isResettingDesks}
                  className="flex items-center space-x-2 flex-1"
                >
                  {isResettingDesks ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  <span>{isResettingDesks ? 'Resetting...' : 'Reset Desks'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tokens List */}
          <Card>
            <CardHeader>
              <CardTitle>Created Tokens</CardTitle>
              <CardDescription>List of all tokens created in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {tokens.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No tokens created yet.</p>
                  <p className="text-sm">Click &quot;Create Token&quot; to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium text-sm">Token #</th>
                        <th className="text-left p-2 font-medium text-sm">Name</th>
                        <th className="text-left p-2 font-medium text-sm">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokens.map((token) => (
                        <tr key={token.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-mono font-semibold text-blue-600 text-sm">
                            #{token.token_number}
                          </td>
                          <td className="p-2 text-sm">{token.name}</td>
                          <td className="p-2 text-gray-600 text-xs">
                            {new Date(token.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Desks List */}
          <Card>
            <CardHeader>
              <CardTitle>Created Desks</CardTitle>
              <CardDescription>List of all desks created in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {desks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No desks created yet.</p>
                  <p className="text-sm">Click &quot;Add Desk&quot; to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium text-sm">Desk #</th>
                        <th className="text-left p-2 font-medium text-sm">Name</th>
                        <th className="text-left p-2 font-medium text-sm">Operator</th>
                        <th className="text-left p-2 font-medium text-sm">Tokens Served</th>
                        <th className="text-left p-2 font-medium text-sm">Status</th>
                        <th className="text-left p-2 font-medium text-sm">Created</th>
                        <th className="text-left p-2 font-medium text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {desks.map((desk) => (
                        <tr key={desk.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-mono font-semibold text-orange-600 text-sm">
                            #{desk.desk_number}
                          </td>
                          <td className="p-2 text-sm">{desk.name}</td>
                          <td className="p-2 text-sm font-medium">{desk.operator_name}</td>
                          <td className="p-2 text-sm">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                              {desk.total_tokens_served}
                            </span>
                          </td>
                          <td className="p-2 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              desk.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {desk.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="p-2 text-gray-600 text-xs">
                            {new Date(desk.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-2">
                            <Button
                              onClick={() => deleteDesk(desk.id, desk.desk_number, desk.name)}
                              disabled={deletingDeskId === desk.id}
                              variant="destructive"
                              size="sm"
                              className="h-7 w-7 p-0"
                            >
                              {deletingDeskId === desk.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create Token Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Token</DialogTitle>
              <DialogDescription>
                Enter a name for the new token. Token #{tokenCounter ? tokenCounter.last_token_number + 1 : 1} will be created.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="Enter token name"
                  className="col-span-3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isCreating) {
                      createToken();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setTokenName('');
                }}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                onClick={createToken}
                disabled={isCreating || !tokenName.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Token'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Desk Dialog */}
        <Dialog open={isDeskDialogOpen} onOpenChange={setIsDeskDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Desk</DialogTitle>
              <DialogDescription>
                Enter the operator name for the new desk. Desk #{deskCounter ? deskCounter.last_desk_number + 1 : 1} will be created.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="operator" className="text-right">
                  Operator Name
                </Label>
                <Input
                  id="operator"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="Enter operator name"
                  className="col-span-3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isAddingDesk) {
                      addDesk();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsDeskDialogOpen(false);
                  setOperatorName('');
                }}
                disabled={isAddingDesk}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                onClick={addDesk}
                disabled={isAddingDesk || !operatorName.trim()}
              >
                {isAddingDesk ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Add Desk'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}