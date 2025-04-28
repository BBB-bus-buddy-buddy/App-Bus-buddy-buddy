import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';

// API 기본 URL 설정
export const API_BASE_URL = Platform.select({
  ios: 'http://localhost:8088',
  android: 'http://10.0.2.2:8088', // Android 에뮬레이터에서 localhost 접근용
});

// 응답 타입 정의
export interface ApiResponse<T> {
  data: T;
  message: string;
}

class ApiClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000, // 15초
    });

    // 요청 인터셉터 설정 - 토큰 자동 추가
    this.axiosInstance.interceptors.request.use(
      async config => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      error => {
        return Promise.reject(error);
      },
    );

    // 응답 인터셉터 설정 - 에러 처리
    this.axiosInstance.interceptors.response.use(
      response => response,
      async error => {
        // 401 에러 처리 (토큰 만료 등)
        if (error.response?.status === 401) {
          await AsyncStorage.removeItem('token');
          // 로그인 화면으로 리다이렉트하는 로직은 별도로 구현해야 함
        }
        return Promise.reject(error);
      },
    );
  }

  // GET 요청
  async get<T>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> =
        await this.axiosInstance.get(url, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // POST 요청
  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> =
        await this.axiosInstance.post(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // PUT 요청
  async put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> =
        await this.axiosInstance.put(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // DELETE 요청
  async delete<T>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> =
        await this.axiosInstance.delete(url, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // 에러 처리 메서드
  private handleError(error: any): void {
    if (axios.isAxiosError(error)) {
      console.error(
        'API Error:',
        error.response?.status,
        error.response?.data?.message || error.message,
      );
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// 싱글톤 인스턴스 생성
const apiClient = new ApiClient();
export default apiClient;
