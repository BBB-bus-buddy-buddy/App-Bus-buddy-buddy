import apiClient from '../apiClient';

export interface RouteStation {
  location: any;
  sequence: number;
  stationId: string;
  stationName: string;
}

export interface Route {
  id: string;
  routeName: string;
  organizationId: string;
  stations: RouteStation[];
}

export interface RouteRequest {
  routeName: string;
  stations: {
    sequence: number;
    stationId: string;
  }[];
}

export const routeService = {
  // 모든 라우트 조회
  async getAllRoutes(): Promise<Route[]> {
    const response = await apiClient.get<Route[]>('/api/routes');
    return response.data;
  },

  // 라우트 검색
  async searchRoutes(name: string): Promise<Route[]> {
    const response = await apiClient.get<Route[]>('/api/routes', {
      params: {name},
    });
    return response.data;
  },

  // 특정 라우트 조회
  async getRouteById(id: string): Promise<Route> {
    const response = await apiClient.get<Route>(`/api/routes/${id}`);
    return response.data;
  },

  // 라우트 생성
  async createRoute(routeData: RouteRequest): Promise<Route> {
    const response = await apiClient.post<Route>('/api/routes', routeData);
    return response.data;
  },

  // 라우트 업데이트
  async updateRoute(routeData: RouteRequest): Promise<Route> {
    const response = await apiClient.put<Route>('/api/routes', routeData);
    return response.data;
  },

  // 라우트 삭제
  async deleteRoute(id: string): Promise<void> {
    await apiClient.delete<void>(`/api/routes/${id}`);
  },
};
