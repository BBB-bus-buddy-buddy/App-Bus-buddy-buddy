import apiClient from '../apiClient';

export interface UserInfo {
  name: string;
  email: string;
  role: string;
  organizationId?: string;
}

export const authService = {
  // 사용자 정보 조회
  async getUserInfo(): Promise<UserInfo> {
    const response = await apiClient.get<UserInfo>('/api/auth/user');
    return response.data;
  },

  // 로그아웃
  async logout(): Promise<boolean> {
    const response = await apiClient.post<boolean>('/api/auth/logout');
    return response.data;
  },

  // 역할 업그레이드 (GUEST -> USER)
  async rankUpUser(code: string): Promise<boolean> {
    const response = await apiClient.post<boolean>('/api/auth/rankUp', {code});
    return response.data;
  },
};
