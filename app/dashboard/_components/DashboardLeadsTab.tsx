'use client';

import { MessageSquare } from 'lucide-react';
import ProfileAvatar from '@/components/ProfileAvatar';
import type { LanguageType } from '@/lib/context/LanguageContext';
import { formatPropertyLocation } from '@/lib/textHelpers';
import type { Lead, Property, User } from '@/lib/types';

interface DashboardLeadsTabProps {
  leads: Lead[];
  properties: Property[];
  users: User[];
  language: LanguageType;
}

export function DashboardLeadsTab({
  leads,
  properties,
  users,
  language,
}: DashboardLeadsTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-bold text-brand-black tracking-tight">
            {language === 'es' ? 'Leads recibidos' : 'Received leads'}
          </h2>
          <p className="text-xs text-brand-gray-500 font-medium">
            {language === 'es'
              ? 'Primeras solicitudes de renta o venta recibidas desde tus propiedades.'
              : 'Early rent or sale requests received from your properties.'}
          </p>
        </div>
      </div>

      {leads.length > 0 ? (
        <div className="flex flex-col gap-3">
          {leads.map((lead) => {
            const leadProperty = properties.find((property) => property.id === lead.propertyId);
            const leadUser = users.find((user) => user.id === lead.userId);
            const leadTypeLabel = lead.leadType === 'SALE'
              ? (language === 'es' ? 'Venta' : 'Sale')
              : lead.leadType === 'MONTHLY_RENT'
                ? (language === 'es' ? 'Renta mensual' : 'Monthly rent')
                : (language === 'es' ? 'Renta temporal' : 'Short rent');

            return (
              <div
                key={lead.id}
                className="bg-white border border-brand-gray-200/80 rounded-3xl p-5 shadow-premium flex flex-col gap-4"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-brand-accent/10 text-brand-accent flex items-center justify-center shrink-0">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-extrabold text-brand-black">
                          {leadProperty?.title || (language === 'es' ? 'Propiedad' : 'Property')}
                        </h3>
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-brand-accent/5 text-brand-accent border border-brand-accent/20">
                          {leadTypeLabel}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-brand-gray-100 text-brand-gray-500">
                          {lead.status}
                        </span>
                      </div>
                      <p className="text-xs text-brand-gray-500 font-semibold mt-1">
                        {leadProperty
                          ? formatPropertyLocation(leadProperty.location, leadProperty.country)
                          : lead.propertyId}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">
                    {new Date(lead.createdAt).toLocaleDateString(
                      language === 'es' ? 'es-MX' : 'en-US',
                      { day: 'numeric', month: 'short', year: 'numeric' },
                    )}
                  </span>
                </div>

                <p className="text-sm text-brand-gray-600 font-medium leading-relaxed bg-brand-gray-50/70 rounded-2xl p-4 border border-brand-gray-100">
                  {lead.message}
                </p>

                <div className="flex items-center justify-between gap-3 border-t border-brand-gray-100 pt-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <ProfileAvatar
                      src={leadUser?.avatar}
                      name={leadUser?.name || (language === 'es' ? 'Usuario interesado' : 'Interested user')}
                      className="h-8 w-8 border border-brand-gray-200"
                      textClassName="text-[10px]"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-brand-black truncate">
                        {leadUser?.name || (language === 'es' ? 'Usuario interesado' : 'Interested user')}
                      </p>
                      <p className="text-[10px] text-brand-gray-400 font-semibold truncate">
                        {language === 'es' ? 'Solicitud capturada' : 'Captured request'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-brand-gray-200/50 shadow-premium p-8">
          <MessageSquare className="w-10 h-10 text-brand-gray-300 mx-auto mb-3" />
          <h3 className="font-bold text-brand-black text-sm mb-1">
            {language === 'es' ? 'Aún no hay leads recibidos' : 'No received leads yet'}
          </h3>
          <p className="text-brand-gray-500 text-xs max-w-sm mx-auto">
            {language === 'es'
              ? 'Cuando alguien consulte renta o venta en una de tus propiedades, aparecerá aquí.'
              : 'When someone asks about rent or sale on one of your properties, it will appear here.'}
          </p>
        </div>
      )}
    </div>
  );
}
