-- =========================================================================
-- AuraSwap SQL Migration — Fase 4G: Mis Viajes y Reglas de Negocio
-- =========================================================================
-- Execute this script inside the Supabase SQL Editor to provision
-- the database rules, constraints, triggers, and relational schemas.
-- =========================================================================

-- 1. PREVENCIÓN DE AUTO-INTERCAMBIO (RESTRICTION ON swaps)
-- Evita cualquier bypass de auto-propuestas
ALTER TABLE public.swaps 
  ADD CONSTRAINT check_not_self_swap CHECK (sender_id <> receiver_id);

COMMENT ON CONSTRAINT check_not_self_swap ON public.swaps IS 'Constraint that prevents users from swapping with their own properties';


-- 2. GESTIÓN DE CONVERSACIONES ARCHIVADAS
-- Tabla de cruce relacional para registrar qué hilos archiva cada usuario de manera individual
CREATE TABLE IF NOT EXISTS public.archived_conversations (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  swap_id uuid REFERENCES public.swaps(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, swap_id)
);

-- Habilitar Seguridad de Fila (RLS)
ALTER TABLE public.archived_conversations ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad RLS
CREATE POLICY "Users can manage their own archived list" 
  ON public.archived_conversations
  FOR ALL 
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.archived_conversations IS 'Junction table to track conversation threads archived per user';


-- 3. BLOQUEO AUTOMÁTICO DE FECHAS (DATABASE OVERLAP PREVENTION TRIGGER)
-- Función que verifica solapamiento de fechas para swaps aprobados, confirmados o activos
CREATE OR REPLACE FUNCTION public.check_swap_overlap()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('APPROVED', 'CONFIRMED', 'ACTIVE') THEN
    IF EXISTS (
      SELECT 1 FROM public.swaps
      WHERE id <> NEW.id
        AND status IN ('APPROVED', 'CONFIRMED', 'ACTIVE')
        AND (
          sender_property_id = NEW.sender_property_id 
          OR receiver_property_id = NEW.sender_property_id 
          OR sender_property_id = NEW.receiver_property_id 
          OR receiver_property_id = NEW.receiver_property_id
        )
        AND (NEW.start_date, NEW.end_date) OVERLAPS (start_date, end_date)
    ) THEN
      RAISE EXCEPTION 'Colisión de fechas detectada. Las fechas seleccionadas ya se encuentran reservadas.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger antes de insertar o actualizar reservas
CREATE OR REPLACE TRIGGER check_swap_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.swaps
  FOR EACH ROW 
  EXECUTE PROCEDURE public.check_swap_overlap();

COMMENT ON TRIGGER check_swap_overlap_trigger ON public.swaps IS 'Trigger to prevent overlapping active swap proposals';


-- 4. CREDENCIALES DE CHECK-IN Y DETALLES DE LOGÍSTICA (ETAPA B)
-- Tabla relacional segura vinculada por swap y viajero para preservar el historial y bidireccionalidad
CREATE TABLE IF NOT EXISTS public.swap_travel_details (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  swap_id uuid REFERENCES public.swaps(id) ON DELETE CASCADE NOT NULL,
  traveler_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  wifi_name text,
  wifi_password text,
  access_code text,
  checkin_instructions text,
  checkin_time text DEFAULT '15:00',
  checkout_time text DEFAULT '11:00',
  emergency_contact_name text,
  emergency_contact_phone text,
  host_notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT unique_swap_traveler UNIQUE (swap_id, traveler_id)
);

-- Habilitar RLS
ALTER TABLE public.swap_travel_details ENABLE ROW LEVEL SECURITY;

-- RLS Políticas de Seguridad Rigurosa
-- 1. El viajero puede leer, el host propietario puede leer
CREATE POLICY "Secure access to swap travel details" 
  ON public.swap_travel_details
  FOR SELECT 
  USING (
    auth.uid() = traveler_id 
    OR 
    auth.uid() = (SELECT host_id FROM public.properties WHERE id = property_id)
  );

-- 2. El host propietario del alojamiento puede crear/actualizar los detalles para su huésped
CREATE POLICY "Hosts can manage swap travel details" 
  ON public.swap_travel_details
  FOR ALL 
  USING (
    auth.uid() = (SELECT host_id FROM public.properties WHERE id = property_id)
  );

COMMENT ON TABLE public.swap_travel_details IS 'Secure logistics table recording check-in credentials per swap traveler';
