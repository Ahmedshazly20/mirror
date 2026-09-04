import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Trash2, Mail, Lock, ShieldCheck, UserPlus, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '../services/authService';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export function StaffManagement() {
  const { t, i18n } = useTranslation();
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const isRTL = i18n.language.startsWith('ar');

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const data = await authService.getAllStaff();
      setStaff(data);
    } catch (err) {
      toast.error('Failed to fetch staff');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    
    setIsAdding(true);
    try {
      await authService.createStaff(newEmail, newPassword);
      toast.success('Staff member created successfully');
      setNewEmail('');
      setNewPassword('');
      fetchStaff();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create staff');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteStaff = async (uid: string) => {
    if (!confirm(t('settings.deleteStaffConfirm'))) return;
    
    try {
      await authService.deleteStaff(uid);
      toast.success('Staff member removed');
      fetchStaff();
    } catch (err) {
      toast.error('Failed to remove staff');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-cyan-500/20"></div>
        <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest animate-pulse">Initializing Team...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2rem] overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
                {t('settings.staffTitle')}
              </CardTitle>
              <CardDescription className="text-slate-500 font-medium">
                {t('settings.staffDesc')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-8 pt-4 space-y-10">
          <motion.form 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleAddStaff} 
            className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 shadow-inner group transition-all"
          >
            <div className="space-y-3">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 group-hover:text-cyan-500 transition-colors">
                <Mail className="w-3 h-3" /> {t('settings.staffEmail')}
              </Label>
              <Input 
                type="email" 
                value={newEmail} 
                onChange={(e) => setNewEmail(e.target.value)} 
                placeholder="staff@operix.com"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl h-12 font-bold shadow-sm focus:ring-4 focus:ring-cyan-500/10"
                required
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2 group-hover:text-cyan-500 transition-colors">
                <Lock className="w-3 h-3" /> {t('settings.staffPass')}
              </Label>
              <Input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                placeholder="••••••••"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl h-12 font-bold shadow-sm focus:ring-4 focus:ring-cyan-500/10"
                required
                minLength={6}
              />
            </div>
            <div className="flex items-end">
              <Button 
                type="submit" 
                disabled={isAdding}
                className="w-full h-12 bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl shadow-xl shadow-cyan-500/20 gap-3 font-black uppercase text-[10px] tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <UserPlus className="w-5 h-5" />
                {t('settings.addStaff')}
              </Button>
            </div>
          </motion.form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <AnimatePresence>
              {staff.map((member) => (
                <motion.div 
                   key={member.uid}
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 10 }}
                   className="flex items-center justify-between p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-blue-500/30 group transition-all shadow-sm hover:shadow-2xl hover:-translate-y-1 duration-500"
                >
                  <div className={cn("flex items-center gap-5", isRTL ? 'flex-row-reverse text-right' : '')}>
                    <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white font-black text-xl shadow-inner group-hover:bg-blue-500 group-hover:text-white group-hover:rotate-6 transition-all duration-500">
                      {member.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors uppercase tracking-tight">{member.email}</p>
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{member.role}</span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDeleteStaff(member.uid)}
                    className="w-11 h-11 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-2xl transition-all shadow-sm bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {staff.length === 0 && (
              <div className="col-span-full text-center py-20 bg-slate-50/50 dark:bg-slate-900/10 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem]">
                <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm grayscale opacity-30">
                  <Users className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">No Staff Members</h3>
                <p className="text-slate-500 font-medium max-w-[240px] mx-auto px-4">Start by adding your team members to manage your workspace efficiently.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Team Insights Card */}
      <div className="p-8 rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden group shadow-2xl shadow-slate-900/30">
         <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-1000">
            <ShieldCheck className="w-40 h-40" />
         </div>
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
               <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 backdrop-blur-md">
                 <Sparkles className="w-4 h-4 text-amber-400" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/90">Team Security Protocol</span>
               </div>
               <h4 className="text-2xl font-black leading-tight">Empower your team with<br />multi-access control.</h4>
               <p className="text-slate-400 text-sm font-medium max-w-[320px]">Admins can access everything, while staff focus on day-to-day operations with secure individual logins.</p>
            </div>
            <div className="flex items-center gap-8 px-8 py-6 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-3xl shadow-2xl">
               <div className="text-center">
                  <p className="text-3xl font-black text-white">{staff.length}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Team</p>
               </div>
               <div className="w-px h-12 bg-white/10" />
               <div className="text-center">
                  <p className="text-3xl font-black text-blue-400">Owner</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Tier</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
