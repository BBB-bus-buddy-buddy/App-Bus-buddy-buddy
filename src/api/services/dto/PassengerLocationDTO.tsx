// src/api/services/dto/PassengerLocationDTO.tsx
export interface PassengerLocationDTO {
  userId: string;
  organizationId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}