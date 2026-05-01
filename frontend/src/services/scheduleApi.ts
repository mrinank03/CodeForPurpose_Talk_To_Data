import api from './api';
import { Schedule, ScheduleCreate, ScheduleUpdate } from '../types/schedule';

const BASE = '/api/schedules';

export async function getSchedules(notebookId: string): Promise<Schedule[]> {
  const res = await api.get(`${BASE}/notebook/${notebookId}`);
  return res.data;
}

export async function createSchedule(data: ScheduleCreate): Promise<Schedule> {
  try {
    const res = await api.post(BASE, data);
    return res.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to create schedule');
  }
}

export async function updateSchedule(scheduleId: string, data: ScheduleUpdate): Promise<Schedule> {
  try {
    const res = await api.put(`${BASE}/${scheduleId}`, data);
    return res.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to update schedule');
  }
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  await api.delete(`${BASE}/${scheduleId}`);
}
