'use client';

import { JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal, use, useState } from 'react';
import { useQuery } from 'urql';
import { gql } from '@/lib/gql';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Building2, CheckCircle, Clock, FileText, FolderOpen, Lock } from 'lucide-react';

const GET_CLIENT_PORTAL_DATA = gql(`
  query GetClientPortalData($phoneCode: String!) {
    clientPortalAccess(phoneCode: $phoneCode) {
      client {
        id
        name
        email
        contactName
      }
      projects {
        id
        name
        description
        status
        startDate
        dueDate
        budgetType
        budgetHours
        budgetAmountCents
        currency
        totalHours
        totalAmountCents
      }
      invoices {
        id
        invoiceNumber
        status
        issuedDate
        dueDate
        subtotalCents
        taxAmountCents
        totalCents
        currency
      }
    }
  }
`);

interface PageProps {
  params: Promise<{ code: string }>;
}

export default function ClientPortalPage({ params }: PageProps) {
  const { code } = use(params);
  const [phoneCode, setPhoneCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');

  const [{ data, fetching, error: queryError }] = useQuery({
    query: GET_CLIENT_PORTAL_DATA,
    variables: { phoneCode: phoneCode },
    pause: !isVerified,
  });

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (phoneCode.length < 4) {
      setError('Ingresa al menos los últimos 4 dígitos de tu teléfono');
      return;
    }
    
    setIsVerified(true);
  };

  const formatCurrency = (cents: number, currency: string = 'USD') => {
    const amount = cents / 100;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'completed':
        return 'bg-blue-500';
      case 'on_hold':
        return 'bg-yellow-500';
      case 'paid':
        return 'bg-green-500';
      case 'sent':
        return 'bg-blue-500';
      case 'overdue':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'active':
      case 'sent':
        return <Clock className="h-4 w-4" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4" />;
      default:  
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Activo',
      completed: 'Completado',
      on_hold: 'En Espera',
      archived: 'Archivado',
      draft: 'Borrador',
      sent: 'Enviada',
      paid: 'Pagada',
      overdue: 'Vencida',
      cancelled: 'Cancelada',
    };
    return labels[status] || status;
  };

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Lock className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Portal del Cliente</h1>
            <p className="text-gray-600">
              Ingresa los últimos dígitos de tu teléfono para acceder a tus proyectos y facturas
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <Label htmlFor="phoneCode">Últimos dígitos de teléfono</Label>
              <Input
                id="phoneCode"
                type="text"
                placeholder="Ej: 1234"
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))}
                maxLength={10}
                className="text-center text-lg tracking-wider"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Ingresa al menos los últimos 4 dígitos
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg">
              Acceder
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (queryError || !data?.clientPortalAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 mb-4">
            No se encontró un cliente con ese código. Verifica los dígitos ingresados.
          </p>
          <Button onClick={() => setIsVerified(false)} variant="outline">
            Intentar de nuevo
          </Button>
        </Card>
      </div>
    );
  }

  const { client, projects, invoices } = data.clientPortalAccess;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 py-8">
        {/* Header */}
        <Card className="p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
                {client.contactName && (
                  <p className="text-gray-600">{client.contactName}</p>
                )}
                {client.email && (
                  <p className="text-sm text-gray-500">{client.email}</p>
                )}
              </div>
            </div>
            <Button onClick={() => setIsVerified(false)} variant="outline" size="sm">
              Cerrar Sesión
            </Button>
          </div>
        </Card>

        {/* Projects Section */}
        <Card className="p-6 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <FolderOpen className="h-5 w-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Proyectos ({projects.length})
            </h2>
          </div>

          {projects.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tienes proyectos registrados</p>
          ) : (
            <div className="space-y-4">
              {projects.map((project: { id: Key | null | undefined; name: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; status: string; description: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; startDate: string; dueDate: string; totalHours: number | null; totalAmountCents: number | null; currency: string | undefined; budgetType: string; budgetHours: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; budgetAmountCents: number; }) => (
                <Card key={project.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                        <Badge className={getStatusColor(project.status)}>
                          <span className="flex items-center space-x-1">
                            {getStatusIcon(project.status)}
                            <span>{getStatusLabel(project.status)}</span>
                          </span>
                        </Badge>
                      </div>
                      {project.description && (
                        <p className="text-gray-600 text-sm mb-2">{project.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {project.startDate && (
                      <div>
                        <p className="text-gray-500">Fecha Inicio</p>
                        <p className="font-medium">{formatDate(project.startDate)}</p>
                      </div>
                    )}
                    {project.dueDate && (
                      <div>
                        <p className="text-gray-500">Fecha Entrega</p>
                        <p className="font-medium">{formatDate(project.dueDate)}</p>
                      </div>
                    )}
                    {project.totalHours !== null && (
                      <div>
                        <p className="text-gray-500">Horas Trabajadas</p>
                        <p className="font-medium">{project.totalHours.toFixed(2)}h</p>
                      </div>
                    )}
                    {project.totalAmountCents !== null && (
                      <div>
                        <p className="text-gray-500">Monto Total</p>
                        <p className="font-medium">
                          {formatCurrency(project.totalAmountCents, project.currency)}
                        </p>
                      </div>
                    )}
                  </div>

                  {project.budgetType !== 'none' && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Presupuesto:</span>
                        {project.budgetType === 'hours' && project.budgetHours && (
                          <span className="font-medium">{project.budgetHours} horas</span>
                        )}
                        {project.budgetType === 'amount' && project.budgetAmountCents && (
                          <span className="font-medium">
                            {formatCurrency(project.budgetAmountCents, project.currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Card>

        {/* Invoices Section */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="h-5 w-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Facturas ({invoices.length})
            </h2>
          </div>

          {invoices.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tienes facturas registradas</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Emisión</TableHead>
                    <TableHead>Fecha Vencimiento</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Impuestos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice: { id: Key | null | undefined; invoiceNumber: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; status: string; issuedDate: string; dueDate: string; subtotalCents: number; currency: string | undefined; taxAmountCents: number; totalCents: number; }) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(invoice.status)}>
                          <span className="flex items-center space-x-1">
                            {getStatusIcon(invoice.status)}
                            <span>{getStatusLabel(invoice.status)}</span>
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(invoice.issuedDate)}</TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(invoice.subtotalCents, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(invoice.taxAmountCents, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(invoice.totalCents, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        <a href={`/invoices/public/${invoice.id}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                            Ver Factura
                          </Button>
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
