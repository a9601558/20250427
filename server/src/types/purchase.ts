/**
 * 购买记录类型
 */
export interface Purchase {
  id: string;
  userId: string;
  questionSetId: string;
  purchaseDate: Date | string;
  expiryDate?: Date | string | null;
  price: number;
  currency: string;
  status: 'active' | 'completed' | 'cancelled' | 'expired' | 'pending';
  paymentMethod?: string;
  transactionId?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * 创建购买记录的请求类型
 */
export interface CreatePurchaseRequest {
  userId: string;
  questionSetId: string;
  price: number;
  currency: string;
  paymentMethod?: string;
  expiryDate?: Date | string | null;
}

/**
 * 更新购买状态的请求类型
 */
export interface UpdatePurchaseStatusRequest {
  purchaseId: string;
  status: 'active' | 'completed' | 'cancelled' | 'expired' | 'pending';
  transactionId?: string;
}

/**
 * 购买访问检查响应
 */
export interface AccessCheckResponse {
  hasAccess: boolean;
  remainingDays?: number | null;
  purchaseId?: string;
  expiryDate?: Date | string | null;
} 