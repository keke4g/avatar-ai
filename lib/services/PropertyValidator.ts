import { Property } from '../types';

export interface PropertyValidationError {
  field: string;
  message: string;
}

export interface PropertyValidationResult {
  success: boolean;
  errors: PropertyValidationError[];
}

export class PropertyValidator {
  /**
   * Valida una propiedad por completo antes de intentar insertarla o actualizarla en Supabase.
   */
  public static validatePropertyBeforeInsert(property: Partial<Property>): PropertyValidationResult {
    const errors: PropertyValidationError[] = [];

    // 1. Campos NOT NULL obligatorios
    if (!property.hostId) {
      errors.push({ field: 'hostId', message: 'El anfitrión de la propiedad es requerido.' });
    }
    if (!property.title || !property.title.trim()) {
      errors.push({ field: 'title', message: 'El título de la propiedad es requerido.' });
    }
    if (!property.description || !property.description.trim()) {
      errors.push({ field: 'description', message: 'La descripción de la propiedad es requerida.' });
    }
    if (!property.type) {
      errors.push({ field: 'type', message: 'El tipo de propiedad es requerido.' });
    }
    if (!property.valueRating) {
      errors.push({ field: 'valueRating', message: 'El rango de valor (valueRating) es requerido.' });
    }
    if (!property.location || !property.location.trim()) {
      errors.push({ field: 'location', message: 'La ubicación es requerida.' });
    }
    if (!property.country || !property.country.trim()) {
      errors.push({ field: 'country', message: 'El país es requerido.' });
    }

    // 2. Coordenadas geográficas obligatorias (DESACTIVADO TEMPORALMENTE)
    /*
    if (property.latitude == null) {
      errors.push({ field: 'latitude', message: 'La latitud es requerida para ubicar la propiedad.' });
    } else {
      const latVal = Number(property.latitude);
      if (isNaN(latVal) || latVal < -90 || latVal > 90) {
        errors.push({ field: 'latitude', message: 'La latitud debe ser un número válido entre -90 y 90.' });
      }
    }

    if (property.longitude == null) {
      errors.push({ field: 'longitude', message: 'La longitud es requerida para ubicar la propiedad.' });
    } else {
      const lngVal = Number(property.longitude);
      if (isNaN(lngVal) || lngVal < -180 || lngVal > 180) {
        errors.push({ field: 'longitude', message: 'La longitud debe ser un número válido entre -180 y 180.' });
      }
    }

    // 3. Validación de País Geográfica (Bounding Box)
    if (property.country && property.latitude != null && property.longitude != null) {
      const countryUpper = property.country.toUpperCase();
      const lat = Number(property.latitude);
      const lng = Number(property.longitude);

      if (countryUpper.includes('MÉXICO') || countryUpper.includes('MEXICO')) {
        // México bounding box: Lat [14, 33], Lng [-118, -86]
        if (lat < 14.0 || lat > 33.0 || lng < -118.0 || lng > -86.0) {
          errors.push({
            field: 'location',
            message: 'Las coordenadas seleccionadas no pertenecen a México.'
          });
        }
      } else if (countryUpper.includes('ESPAÑA') || countryUpper.includes('ESPANA') || countryUpper.includes('SPAIN')) {
        // España bounding box: Lat [35, 44], Lng [-10, 5]
        if (lat < 35.0 || lat > 44.0 || lng < -10.0 || lng > 5.0) {
          errors.push({
            field: 'location',
            message: 'Las coordenadas seleccionadas no pertenecen a España.'
          });
        }
      }
    }
    */

    // 4. Tipo de Propiedad e Inconsistencias
    const typeUpper = (property.type || '').toUpperCase();
    const isLand = typeUpper.includes('TERRENO') || typeUpper === 'LAND';
    const isHouse = typeUpper.includes('CASA') || typeUpper === 'HOUSE' || typeUpper.includes('VILLA') || typeUpper.includes('CABIN') || typeUpper.includes('CABAÑA') || typeUpper.includes('BEACH HOUSE');
    const isApartment = typeUpper.includes('DEPARTAMENTO') || typeUpper === 'APARTMENT' || typeUpper === 'PENTHOUSE' || typeUpper === 'LOFT';
    const isCommercial = typeUpper.includes('LOCAL') || typeUpper === 'COMMERCIAL' || typeUpper === 'OFFICE' || typeUpper.includes('OFICINA');

    if (isLand) {
      if (property.bedrooms != null && property.bedrooms > 0) {
        errors.push({ field: 'bedrooms', message: 'Un terreno no debe especificar número de habitaciones.' });
      }
      if (property.bathrooms != null && property.bathrooms > 0) {
        errors.push({ field: 'bathrooms', message: 'Un terreno no debe especificar número de baños.' });
      }
      if (property.levelsCount != null && property.levelsCount > 0) {
        errors.push({ field: 'levelsCount', message: 'Un terreno no debe especificar número de niveles.' });
      }
    } else {
      if (property.bedrooms != null && (isNaN(property.bedrooms) || property.bedrooms < 0)) {
        errors.push({ field: 'bedrooms', message: 'El número de habitaciones debe ser un entero no negativo.' });
      }
      if (property.bathrooms != null && (isNaN(property.bathrooms) || property.bathrooms < 0)) {
        errors.push({ field: 'bathrooms', message: 'El número de baños debe ser un entero no negativo.' });
      }
    }

    if (isHouse) {
      if (property.levelsCount == null || property.levelsCount <= 0) {
        errors.push({ field: 'levelsCount', message: 'Una casa requiere especificar el número de niveles.' });
      }
    }

    if (isApartment) {
      if (property.levelsCount == null || property.levelsCount <= 0) {
        errors.push({ field: 'levelsCount', message: 'Un departamento requiere especificar el nivel en el que se encuentra.' });
      }
    }

    if (isCommercial) {
      if (property.bedrooms != null && property.bedrooms > 0) {
        errors.push({ field: 'bedrooms', message: 'Un local comercial u oficina no debe especificar habitaciones de vivienda.' });
      }
    }

    // 5. Ofertas y precios (Consistencia)
    if (!property.offerings || property.offerings.length === 0) {
      errors.push({ field: 'offerings', message: 'La propiedad debe incluir al menos una modalidad comercial activa (SWAP, RENT o SALE).' });
    } else {
      property.offerings.forEach((offering, idx) => {
        const mode = offering.mode;
        if (mode === 'SALE') {
          if (offering.priceAmount == null || isNaN(offering.priceAmount) || offering.priceAmount <= 0) {
            errors.push({ field: 'salePrice', message: 'El precio de venta debe ser un número mayor a cero.' });
          }
        } else if (mode === 'SHORT_RENT' || mode === 'MONTHLY_RENT') {
          if (offering.priceAmount == null || isNaN(offering.priceAmount) || offering.priceAmount <= 0) {
            errors.push({ field: 'rentPrice', message: 'El precio de renta debe ser un número mayor a cero.' });
          }
        } else if (mode === 'SWAP') {
          // desiredExchange es requerido
          const desired = offering.desiredExchange || property.desiredExchange;
          if (!desired || !String(desired).trim()) {
            errors.push({ field: 'swapPreferences', message: 'Las preferencias de intercambio (desired exchange) son obligatorias para la modalidad Swap.' });
          }
        }
      });
    }

    // 6. Validación de imágenes
    if (!property.images || property.images.length === 0) {
      errors.push({ field: 'images', message: 'Se debe subir al menos una imagen de la propiedad.' });
    } else {
      const urls = new Set<string>();
      property.images.forEach((img, idx) => {
        if (!img || !img.trim().startsWith('http')) {
          errors.push({ field: 'images', message: `La imagen en la posición ${idx + 1} no tiene una URL válida.` });
        }
        if (urls.has(img)) {
          errors.push({ field: 'images', message: 'No se permiten imágenes duplicadas.' });
        }
        urls.add(img);
      });
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Valida un paso (step) específico del PropertyWizardModal
   */
  public static validateStep(step: number, data: any): PropertyValidationResult {
    const errors: PropertyValidationError[] = [];

    if (step === 1) {
      // Información Básica
      if (!data.title || !data.title.trim()) {
        errors.push({ field: 'title', message: 'El título del anuncio es requerido.' });
      } else if (data.title.trim().length < 10) {
        errors.push({ field: 'title', message: 'El título debe tener al menos 10 caracteres.' });
      }
      if (!data.description || !data.description.trim()) {
        errors.push({ field: 'description', message: 'La descripción del inmueble es requerida.' });
      } else if (data.description.trim().length < 30) {
        errors.push({ field: 'description', message: 'La descripción debe tener al menos 30 caracteres.' });
      }
    } else if (step === 2) {
      // Ubicación
      if (!data.city || !data.city.trim()) {
        errors.push({ field: 'city', message: 'La ciudad es requerida.' });
      }
      if (!data.location || !data.location.trim()) {
        errors.push({ field: 'location', message: 'La ubicación de la propiedad es requerida.' });
      }
      if (!data.country || !data.country.trim()) {
        errors.push({ field: 'country', message: 'El país es requerido.' });
      }
      // Coordenadas geográficas (DESACTIVADO TEMPORALMENTE)
      /*
      if (data.latitude == null || isNaN(Number(data.latitude))) {
        errors.push({ field: 'latitude', message: 'La latitud es requerida. Selecciona un punto en el mapa.' });
      }
      if (data.longitude == null || isNaN(Number(data.longitude))) {
        errors.push({ field: 'longitude', message: 'La longitud es requerida. Selecciona un punto en el mapa.' });
      }

      // Validación de bounding box por país en paso 2
      if (data.country && data.latitude != null && data.longitude != null) {
        const countryUpper = data.country.toUpperCase();
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);

        if (countryUpper.includes('MÉXICO') || countryUpper.includes('MEXICO')) {
          if (lat < 14.0 || lat > 33.0 || lng < -118.0 || lng > -86.0) {
            errors.push({ field: 'location', message: 'Las coordenadas seleccionadas no pertenecen a México.' });
          }
        } else if (countryUpper.includes('ESPAÑA') || countryUpper.includes('ESPANA') || countryUpper.includes('SPAIN')) {
          if (lat < 35.0 || lat > 44.0 || lng < -10.0 || lng > 5.0) {
            errors.push({ field: 'location', message: 'Las coordenadas seleccionadas no pertenecen a España.' });
          }
        }
      }
      */
    } else if (step === 3) {
      // Operación
      if (!data.selectedModes || data.selectedModes.length === 0) {
        errors.push({ field: 'selectedModes', message: 'Selecciona al menos una modalidad comercial para publicar.' });
      }
    } else if (step === 4) {
      // Características e Inconsistencias
      const typeUpper = (data.type || '').toUpperCase();
      const isLand = typeUpper.includes('TERRENO') || typeUpper === 'LAND';
      const isHouse = typeUpper.includes('CASA') || typeUpper === 'HOUSE' || typeUpper.includes('VILLA') || typeUpper.includes('CABIN') || typeUpper.includes('CABAÑA') || typeUpper.includes('BEACH HOUSE');
      const isApartment = typeUpper.includes('DEPARTAMENTO') || typeUpper === 'APARTMENT' || typeUpper === 'PENTHOUSE' || typeUpper === 'LOFT';

      if (isLand) {
        if (Number(data.bedrooms) > 0) {
          errors.push({ field: 'bedrooms', message: 'Un terreno no debe especificar número de habitaciones.' });
        }
        if (Number(data.bathrooms) > 0) {
          errors.push({ field: 'bathrooms', message: 'Un terreno no debe especificar número de baños.' });
        }
        if (Number(data.levelsCount) > 0) {
          errors.push({ field: 'levelsCount', message: 'Un terreno no debe especificar número de niveles.' });
        }
      } else {
        if (data.bedrooms == null || isNaN(Number(data.bedrooms)) || Number(data.bedrooms) < 0) {
          errors.push({ field: 'bedrooms', message: 'El número de habitaciones debe ser un número entero no negativo.' });
        }
        if (data.bathrooms == null || isNaN(Number(data.bathrooms)) || Number(data.bathrooms) < 0) {
          errors.push({ field: 'bathrooms', message: 'El número de baños debe ser un número entero no negativo.' });
        }
      }

      if (isHouse) {
        if (data.levelsCount == null || isNaN(Number(data.levelsCount)) || Number(data.levelsCount) <= 0) {
          errors.push({ field: 'levelsCount', message: 'Una casa requiere especificar el número de niveles.' });
        }
      }

      if (isApartment) {
        if (data.levelsCount == null || isNaN(Number(data.levelsCount)) || Number(data.levelsCount) <= 0) {
          errors.push({ field: 'levelsCount', message: 'Un departamento requiere especificar el nivel en el que se encuentra.' });
        }
      }
    } else if (step === 6) {
      // Preferencias Swap
      if (data.selectedModes.includes('SWAP')) {
        if (!data.swapPreferences || !data.swapPreferences.trim()) {
          errors.push({ field: 'swapPreferences', message: 'Las preferencias de intercambio son obligatorias.' });
        }
      }
    } else if (step === 7) {
      // Condiciones de Renta
      if (data.selectedModes.includes('RENT' as any) || data.selectedModes.includes('SHORT_RENT') || data.selectedModes.includes('MONTHLY_RENT')) {
        const price = Number(data.monthlyPrice || data.nightlyPrice || 0);
        if (price <= 0 || isNaN(price)) {
          errors.push({ field: 'rentPrice', message: 'El precio de renta mensual o por noche debe ser mayor a cero.' });
        }
      }
    } else if (step === 8) {
      // Términos de Venta
      if (data.selectedModes.includes('SALE')) {
        const price = Number(data.salePrice || 0);
        if (price <= 0 || isNaN(price)) {
          errors.push({ field: 'salePrice', message: 'El precio de venta debe ser mayor a cero.' });
        }
      }
    } else if (step === 9) {
      // Multimedia
      if (!data.images || data.images.length === 0) {
        errors.push({ field: 'images', message: 'Se requiere subir al menos una imagen de la propiedad.' });
      }
    }

    return {
      success: errors.length === 0,
      errors
    };
  }
}
