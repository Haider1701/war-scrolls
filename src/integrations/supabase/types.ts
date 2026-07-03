export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ability_scores: {
        Row: {
          character_id: string
          charisma: number | null
          constitution: number | null
          dexterity: number | null
          id: string
          intelligence: number | null
          strength: number | null
          wisdom: number | null
        }
        Insert: {
          character_id: string
          charisma?: number | null
          constitution?: number | null
          dexterity?: number | null
          id?: string
          intelligence?: number | null
          strength?: number | null
          wisdom?: number | null
        }
        Update: {
          character_id?: string
          charisma?: number | null
          constitution?: number | null
          dexterity?: number | null
          id?: string
          intelligence?: number | null
          strength?: number | null
          wisdom?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ability_scores_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      attacks: {
        Row: {
          attack_bonus: string | null
          character_id: string
          damage_dice: string | null
          damage_type: string | null
          id: string
          weapon_name: string | null
        }
        Insert: {
          attack_bonus?: string | null
          character_id: string
          damage_dice?: string | null
          damage_type?: string | null
          id?: string
          weapon_name?: string | null
        }
        Update: {
          attack_bonus?: string | null
          character_id?: string
          damage_dice?: string | null
          damage_type?: string | null
          id?: string
          weapon_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attacks_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_members: {
        Row: {
          campaign_id: string
          character_id: string | null
          id: string
          joined_at: string
          player_user_id: string
        }
        Insert: {
          campaign_id: string
          character_id?: string | null
          id?: string
          joined_at?: string
          player_user_id: string
        }
        Update: {
          campaign_id?: string
          character_id?: string | null
          id?: string
          joined_at?: string
          player_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          dm_user_id: string
          id: string
          join_code: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          dm_user_id: string
          id?: string
          join_code: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          dm_user_id?: string
          id?: string
          join_code?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      character_images: {
        Row: {
          character_id: string
          created_at: string
          id: string
          image_url: string
          is_primary: boolean
          sort_order: number
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          image_url: string
          is_primary?: boolean
          sort_order?: number
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          image_url?: string
          is_primary?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_images_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          affliction_note: string | null
          alignment: string | null
          armor_class: number | null
          armor_prof: string | null
          background: string | null
          backstory: string | null
          character_type: string
          class_level: string | null
          class_level_2: string | null
          created_at: string
          custom_theme: Json | null
          features: Json | null
          hp_current: number | null
          hp_max: number | null
          id: string
          image_url: string | null
          languages: string | null
          name: string
          npc_actions: string | null
          npc_quotes: string | null
          passive_perception: number | null
          proficiency_bonus: number | null
          race: string | null
          speed: number | null
          subtitle: string | null
          theme: string | null
          tools_prof: string | null
          user_id: string
          weapons_prof: string | null
        }
        Insert: {
          affliction_note?: string | null
          alignment?: string | null
          armor_class?: number | null
          armor_prof?: string | null
          background?: string | null
          backstory?: string | null
          character_type?: string
          class_level?: string | null
          class_level_2?: string | null
          created_at?: string
          custom_theme?: Json | null
          features?: Json | null
          hp_current?: number | null
          hp_max?: number | null
          id?: string
          image_url?: string | null
          languages?: string | null
          name?: string
          npc_actions?: string | null
          npc_quotes?: string | null
          passive_perception?: number | null
          proficiency_bonus?: number | null
          race?: string | null
          speed?: number | null
          subtitle?: string | null
          theme?: string | null
          tools_prof?: string | null
          user_id: string
          weapons_prof?: string | null
        }
        Update: {
          affliction_note?: string | null
          alignment?: string | null
          armor_class?: number | null
          armor_prof?: string | null
          background?: string | null
          backstory?: string | null
          character_type?: string
          class_level?: string | null
          class_level_2?: string | null
          created_at?: string
          custom_theme?: Json | null
          features?: Json | null
          hp_current?: number | null
          hp_max?: number | null
          id?: string
          image_url?: string | null
          languages?: string | null
          name?: string
          npc_actions?: string | null
          npc_quotes?: string | null
          passive_perception?: number | null
          proficiency_bonus?: number | null
          race?: string | null
          speed?: number | null
          subtitle?: string | null
          theme?: string | null
          tools_prof?: string | null
          user_id?: string
          weapons_prof?: string | null
        }
        Relationships: []
      }
      currency: {
        Row: {
          character_id: string
          cp: number | null
          ep: number | null
          gp: number | null
          id: string
          pp: number | null
          sp: number | null
        }
        Insert: {
          character_id: string
          cp?: number | null
          ep?: number | null
          gp?: number | null
          id?: string
          pp?: number | null
          sp?: number | null
        }
        Update: {
          character_id?: string
          cp?: number | null
          ep?: number | null
          gp?: number | null
          id?: string
          pp?: number | null
          sp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "currency_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          character_id: string
          emoji_icon: string | null
          id: string
          name: string | null
          quantity: number | null
        }
        Insert: {
          character_id: string
          emoji_icon?: string | null
          id?: string
          name?: string | null
          quantity?: number | null
        }
        Update: {
          character_id?: string
          emoji_icon?: string | null
          id?: string
          name?: string | null
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      free_notes: {
        Row: {
          character_id: string
          content: string | null
          id: string
        }
        Insert: {
          character_id: string
          content?: string | null
          id?: string
        }
        Update: {
          character_id?: string
          content?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_notes_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      gm_notifications: {
        Row: {
          created_at: string
          from_character_id: string | null
          from_user_id: string
          gm_user_id: string
          id: string
          is_read: boolean
          message: string
          spell_id: string | null
        }
        Insert: {
          created_at?: string
          from_character_id?: string | null
          from_user_id: string
          gm_user_id: string
          id?: string
          is_read?: boolean
          message?: string
          spell_id?: string | null
        }
        Update: {
          created_at?: string
          from_character_id?: string | null
          from_user_id?: string
          gm_user_id?: string
          id?: string
          is_read?: boolean
          message?: string
          spell_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gm_notifications_from_character_id_fkey"
            columns: ["from_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gm_notifications_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      npcs: {
        Row: {
          character_id: string
          description: string | null
          disposition: string | null
          emoji_icon: string | null
          id: string
          name: string | null
          role: string | null
        }
        Insert: {
          character_id: string
          description?: string | null
          disposition?: string | null
          emoji_icon?: string | null
          id?: string
          name?: string | null
          role?: string | null
        }
        Update: {
          character_id?: string
          description?: string | null
          disposition?: string | null
          emoji_icon?: string | null
          id?: string
          name?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "npcs_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          character_id: string
          created_at: string
          date_played: string | null
          encounter_notes: string | null
          id: string
          notes: string[] | null
          session_number: number | null
          title: string | null
        }
        Insert: {
          character_id: string
          created_at?: string
          date_played?: string | null
          encounter_notes?: string | null
          id?: string
          notes?: string[] | null
          session_number?: number | null
          title?: string | null
        }
        Update: {
          character_id?: string
          created_at?: string
          date_played?: string | null
          encounter_notes?: string | null
          id?: string
          notes?: string[] | null
          session_number?: number | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          character_id: string
          id: string
          kind: string | null
          modifier: number | null
          name: string
          proficient: boolean | null
        }
        Insert: {
          character_id: string
          id?: string
          kind?: string | null
          modifier?: number | null
          name: string
          proficient?: boolean | null
        }
        Update: {
          character_id?: string
          id?: string
          kind?: string | null
          modifier?: number | null
          name?: string
          proficient?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "skills_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      spell_meta: {
        Row: {
          character_id: string
          id: string
          slot_counts: Json | null
          slots_used: Json | null
          spell_attack_bonus: number | null
          spell_save_dc: number | null
          spellcasting_ability: string | null
        }
        Insert: {
          character_id: string
          id?: string
          slot_counts?: Json | null
          slots_used?: Json | null
          spell_attack_bonus?: number | null
          spell_save_dc?: number | null
          spellcasting_ability?: string | null
        }
        Update: {
          character_id?: string
          id?: string
          slot_counts?: Json | null
          slots_used?: Json | null
          spell_attack_bonus?: number | null
          spell_save_dc?: number | null
          spellcasting_ability?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spell_meta_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      spells: {
        Row: {
          casting_time: string | null
          character_id: string
          components: string | null
          description: string | null
          duration: string | null
          gm_approved: boolean
          gm_denied: boolean
          id: string
          is_homebrew: boolean
          name: string | null
          range: string | null
          school: string | null
          spell_level: number | null
          upcast_note: string | null
        }
        Insert: {
          casting_time?: string | null
          character_id: string
          components?: string | null
          description?: string | null
          duration?: string | null
          gm_approved?: boolean
          gm_denied?: boolean
          id?: string
          is_homebrew?: boolean
          name?: string | null
          range?: string | null
          school?: string | null
          spell_level?: number | null
          upcast_note?: string | null
        }
        Update: {
          casting_time?: string | null
          character_id?: string
          components?: string | null
          description?: string | null
          duration?: string | null
          gm_approved?: boolean
          gm_denied?: boolean
          id?: string
          is_homebrew?: boolean
          name?: string | null
          range?: string | null
          school?: string | null
          spell_level?: number | null
          upcast_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spells_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      traits: {
        Row: {
          bond: string | null
          character_id: string
          flaw: string | null
          id: string
          ideal: string | null
          personality: string | null
        }
        Insert: {
          bond?: string | null
          character_id: string
          flaw?: string | null
          id?: string
          ideal?: string | null
          personality?: string | null
        }
        Update: {
          bond?: string | null
          character_id?: string
          flaw?: string | null
          id?: string
          ideal?: string | null
          personality?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traits_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_custom_themes: {
        Row: {
          created_at: string
          id: string
          name: string
          theme: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          theme: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          theme?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          is_gm: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_gm?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_gm?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_campaign_dm: { Args: { _campaign_id: string }; Returns: boolean }
      is_character_owner: { Args: { _character_id: string }; Returns: boolean }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
