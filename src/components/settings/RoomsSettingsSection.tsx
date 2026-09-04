import React from 'react';
import { useTranslation } from 'react-i18next';
import { Table2, Plus, ChevronDown, Trash2, Layout, UserCircle, BadgeDollarSign, DoorOpen, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { WorkspaceSettings, Room, RoomType } from '../../types';
import { SUPPORTED_SPACE_TYPES, ROOM_TYPE_LABELS, DEFAULT_BOOKABLE_ROOMS } from '../../services/pricingService';
import { roomService } from '../../services/roomService';
import { cn } from '@/lib/utils';

interface RoomsSettingsSectionProps {
  localSettings: WorkspaceSettings;
  setLocalSettings: React.Dispatch<React.SetStateAction<WorkspaceSettings>>;
}

export function RoomsSettingsSection({ localSettings, setLocalSettings }: RoomsSettingsSectionProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');
  const [expandedRooms, setExpandedRooms] = React.useState<Set<string>>(new Set());

  const handleResetToDefaults = async () => {
    try {
      const restored = await roomService.resetToDefaultRooms();
      setLocalSettings(prev => ({
        ...prev,
        rooms: restored
      }));
    } catch (e) {
      console.error(e);
      setLocalSettings(prev => ({
        ...prev,
        rooms: [...DEFAULT_BOOKABLE_ROOMS]
      }));
    }
  };

  const addRoom = () => {
    const newRoom: Room = {
      id: `room-${Date.now()}`,
      name: t('settings.newRoom'),
      type: 'office_1',
      pricingType: 'office_1',
      pricePerHour: 100,
      capacity: 4,
      status: 'available',
      active: true,
      tables: []
    };
    const currentRooms = localSettings?.rooms || [];
    setLocalSettings({ ...localSettings, rooms: [...currentRooms, newRoom] });
    setExpandedRooms(new Set([...expandedRooms, newRoom.id]));
  };

  const removeRoom = (id: string) => {
    setLocalSettings({ 
      ...localSettings, 
      rooms: (localSettings?.rooms || []).filter(r => r.id !== id) 
    });
  };

  const updateRoom = (id: string, data: Partial<Room>) => {
    setLocalSettings({
      ...localSettings,
      rooms: (localSettings?.rooms || []).map(r => r.id === id ? { ...r, ...data } : r)
    });
  };

  const toggleRoom = (id: string) => {
    const next = new Set(expandedRooms);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRooms(next);
  };

  const addTable = (roomId: string) => {
    const room = localSettings?.rooms?.find(r => r.id === roomId);
    if (!room) return;
    const newTable = {
      id: Date.now().toString(),
      number: (room.tables?.length || 0) + 1,
      capacity: 1,
      label: ''
    };
    updateRoom(roomId, { tables: [...(room.tables || []), newTable] });
  };

  const removeTable = (roomId: string, tableId: string) => {
    const room = localSettings?.rooms?.find(r => r.id === roomId);
    if (!room) return;
    updateRoom(roomId, { tables: room.tables?.filter(t => t.id !== tableId) });
  };

  const updateTable = (roomId: string, tableId: string, data: any) => {
    const room = localSettings?.rooms?.find(r => r.id === roomId);
    if (!room) return;
    updateRoom(roomId, {
      tables: room.tables?.map(t => t.id === tableId ? { ...t, ...data } : t)
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2rem] overflow-hidden">
        <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Table2 className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
                {t('settings.roomsTitle')}
              </CardTitle>
              <CardDescription className="text-slate-500 font-medium">
                {t('settings.roomsDesc')}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              type="button"
              variant="outline"
              onClick={handleResetToDefaults} 
              className="gap-2 rounded-2xl h-11 px-4 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-500 font-bold"
            >
              <RotateCcw className="w-4 h-4" />
              {isRTL ? 'استعادة الغرف الست المعتمدة' : 'Restore 6 Default Rooms'}
            </Button>
            <Button 
              onClick={addRoom} 
              className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2 rounded-2xl h-11 px-6 shadow-xl shadow-cyan-500/10 transition-all font-bold"
            >
              <Plus className="w-4 h-4" />
              {t('settings.addRoom')}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-8 pt-4">
          <div className="grid grid-cols-1 gap-6">
            <AnimatePresence initial={false}>
              {/* استخدام ?. لتجنب خطأ التكرار على undefined */}
              {localSettings?.rooms?.map((room) => (
                <motion.div 
                  key={room.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md"
                >
                  <div 
                    className={cn(
                      "p-6 flex items-center justify-between cursor-pointer group transition-colors",
                      expandedRooms.has(room.id) ? "bg-slate-50 dark:bg-slate-800/50" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    )}
                    onClick={() => toggleRoom(room.id)}
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-indigo-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-500">
                        <Layout className="w-7 h-7 text-indigo-500" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-slate-900 dark:text-white leading-none mb-1">
                          {room.name || t('settings.unnamedRoom')}
                        </h4>
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                           <span className="flex items-center gap-1">
                             <Table2 className="w-3 h-3" /> {room.tables?.length || 0} {t('common.tables')}
                           </span>
                           <span className="w-1 h-1 bg-slate-200 rounded-full" />
                           <span className="text-indigo-500">{room.pricePerHour} {t('common.currency')}/H</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => { e.stopPropagation(); removeRoom(room.id); }} 
                        className="w-10 h-10 rounded-xl text-rose-400 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                      <div className={cn(
                        "w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center transition-transform duration-300",
                        expandedRooms.has(room.id) ? "rotate-180 bg-cyan-50 dark:bg-cyan-900/30" : ""
                      )}>
                        <ChevronDown className={cn("w-5 h-5", expandedRooms.has(room.id) ? "text-cyan-500" : "text-slate-400")} />
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedRooms.has(room.id) && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden"
                      >
                        <div className="p-8 pt-4 space-y-8 border-t border-slate-100 dark:border-slate-800">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-3">
                              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Layout className="w-3 h-3" /> {t('common.name')}
                              </Label>
                              <Input
                                value={room.name}
                                onChange={(e) => updateRoom(room.id, { name: e.target.value })}
                                className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 font-bold focus:ring-indigo-500/20"
                              />
                            </div>
                            <div className="space-y-3">
                              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <BadgeDollarSign className="w-3 h-3" /> {isRTL ? 'نوع المساحة (التسعير)' : 'Space Type (Pricing)'}
                              </Label>
                              <select
                                value={room.type || 'shared_space'}
                                onChange={(e) => updateRoom(room.id, { type: e.target.value as RoomType, pricingType: e.target.value as RoomType })}
                                className="w-full rounded-2xl h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 font-bold px-3 text-xs focus:ring-indigo-500/20"
                              >
                                {SUPPORTED_SPACE_TYPES.map(st => (
                                  <option key={st.key} value={st.key}>
                                    {st.labelEn} ({ROOM_TYPE_LABELS[st.key]?.[isRTL ? 'ar' : 'en']})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-3">
                              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <BadgeDollarSign className="w-3 h-3" /> {t('settings.pricePerHour')}
                              </Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={room.pricePerHour}
                                  onChange={(e) => updateRoom(room.id, { pricePerHour: parseFloat(e.target.value) || 0 })}
                                  className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 font-bold focus:ring-indigo-500/20 pr-12"
                                />
                                <span className={cn(
                                  "absolute top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400",
                                  isRTL ? "left-4" : "right-4"
                                )}>{t('common.currency')}</span>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <UserCircle className="w-3 h-3" /> {t('common.capacity')}
                              </Label>
                              <Input
                                type="number"
                                value={room.capacity}
                                onChange={(e) => updateRoom(room.id, { capacity: parseInt(e.target.value) || 0 })}
                                className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 font-bold focus:ring-indigo-500/20"
                              />
                            </div>
                          </div>

                          <div className="space-y-5">
                            <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50 pb-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-cyan-500" />
                                <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">{t('settings.tables')}</h4>
                              </div>
                              <Button 
                                onClick={() => addTable(room.id)} 
                                variant="outline" 
                                className="rounded-2xl h-10 px-5 text-sm gap-2 border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-slate-800 text-indigo-600 transition-all font-bold"
                              >
                                <Plus className="w-4 h-4" />
                                {t('settings.addTable')}
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {room.tables?.map((table) => (
                                <motion.div 
                                  key={table.id}
                                  whileHover={{ y: -2 }}
                                  className="p-6 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative group/table hover:shadow-lg transition-all duration-300"
                                >
                                  <div className="absolute -top-3 -right-3">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => removeTable(room.id, table.id)} 
                                      className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-lg text-slate-300 hover:text-rose-500 opacity-0 group-hover/table:opacity-100 transition-all border border-slate-100 dark:border-slate-700 scale-90 group-hover/table:scale-100"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  
                                  <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center font-black text-slate-400 group-hover/table:text-cyan-500 transition-colors">
                                        #{table.number}
                                      </div>
                                      <div className="flex-1">
                                         <Input
                                          placeholder={t('common.label')}
                                          value={table.label || ''}
                                          onChange={(e) => updateTable(room.id, table.id, { label: e.target.value })}
                                          className="h-9 text-xs rounded-xl border-transparent hover:border-slate-100 dark:hover:border-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 px-2 font-bold"
                                        />
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{t('settings.tableNumber')}</Label>
                                        <Input
                                          type="number"
                                          value={table.number}
                                          onChange={(e) => updateTable(room.id, table.id, { number: parseInt(e.target.value) || 0 })}
                                          className="h-10 text-sm rounded-xl font-bold bg-slate-50 dark:bg-slate-800 border-none"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{t('common.capacity')}</Label>
                                        <Input
                                          type="number"
                                          value={table.capacity}
                                          onChange={(e) => updateTable(room.id, table.id, { capacity: parseInt(e.target.value) || 0 })}
                                          className="h-10 text-sm rounded-xl font-bold bg-slate-50 dark:bg-slate-800 border-none"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* عرض حالة عدم وجود غرف بأمان */}
            {(localSettings?.rooms?.length || 0) === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem] bg-slate-50/50 dark:bg-slate-900/30"
              >
                <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <DoorOpen className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No Rooms Configured</h3>
                <p className="text-slate-500 font-medium max-w-[240px] mx-auto mb-8">
                  Get started by adding your first gaming or workspace room.
                </p>
                <Button 
                  onClick={addRoom}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2 rounded-2xl h-12 px-8 font-bold shadow-lg shadow-cyan-500/20"
                >
                  <Plus className="w-5 h-5" />
                  Create First Room
                </Button>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}