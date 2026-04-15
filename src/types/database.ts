export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bybit_accounts: {
        Row: {
          api_key: string
          api_secret: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          proxy_url: string | null
          risk_amount: number
          risk_percent: number | null
          risk_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          api_secret: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          proxy_url?: string | null
          risk_amount?: number
          risk_percent?: number | null
          risk_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          api_secret?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          proxy_url?: string | null
          risk_amount?: number
          risk_percent?: number | null
          risk_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_executions: {
        Row: {
          account_id: string
          account_name: string
          created_at: string
          error_message: string | null
          id: string
          order_id: string | null
          quantity: string | null
          status: string
          trade_log_id: string
        }
        Insert: {
          account_id: string
          account_name: string
          created_at?: string
          error_message?: string | null
          id?: string
          order_id?: string | null
          quantity?: string | null
          status: string
          trade_log_id: string
        }
        Update: {
          account_id?: string
          account_name?: string
          created_at?: string
          error_message?: string | null
          id?: string
          order_id?: string | null
          quantity?: string | null
          status?: string
          trade_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_executions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bybit_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_executions_trade_log_id_fkey"
            columns: ["trade_log_id"]
            isOneToOne: false
            referencedRelation: "trade_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_logs: {
        Row: {
          created_at: string
          entry_price: number | null
          id: string
          leverage: number
          order_type: string
          side: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_price?: number | null
          id?: string
          leverage: number
          order_type?: string
          side: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          entry_price?: number | null
          id?: string
          leverage?: number
          order_type?: string
          side?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R } ? R : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R } ? R : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I } ? I : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I } ? I : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U } ? U : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U } ? U : never
    : never
