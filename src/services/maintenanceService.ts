import { AircraftMaintenance, MaintenanceRecord, Aircraft } from '../types';

export const maintenanceService = {
  // Calculer l'état de santé d'un avion basé sur les heures de vol
  calculateCondition(flightHours: number, maxHours: number): number {
    const condition = Math.max(0, 100 - (flightHours / maxHours) * 100);
    return Math.round(condition);
  },

  // Calculer le coût de maintenance
  calculateMaintenanceCost(aircraft: Aircraft, maintenance: AircraftMaintenance): number {
    const baseCost = aircraft.maintenanceCostPerHour * maintenance.flightHours;

    // Coût supplémentaire si l'avion est en mauvais état
    const conditionPenalty = maintenance.condition < 30 ? baseCost * 0.5 : 0;

    return Math.round(baseCost + conditionPenalty);
  },

  // Calculer le temps de maintenance en heures
  calculateMaintenanceTime(flightHours: number): number {
    // Minimum 2 heures, maximum 48 heures
    const hours = Math.min(48, Math.max(2, Math.floor(flightHours / 10)));
    return hours;
  },

  // Démarrer une maintenance
  async startMaintenance(
    aircraftId: string,
    playerId: string,
    maintenanceType: 'routine' | 'repair' | 'inspection',
    flightHours: number,
    maintenanceCost: number
  ): Promise<{
    success: boolean;
    cost: number;
    endDate: string;
    hours: number;
  }> {
    await new Promise(resolve => setTimeout(resolve, 300));

    // Calculer la durée de maintenance avec la vraie formule
    const maintenanceHours = this.calculateMaintenanceTime(flightHours);
    const endDate = new Date(Date.now() + maintenanceHours * 60 * 60 * 1000).toISOString();

    console.log(`Started ${maintenanceType} maintenance for aircraft ${aircraftId}`);
    console.log(`Player ${playerId} - Duration: ${maintenanceHours}h - Cost: $${maintenanceCost} - End: ${endDate}`);

    return {
      success: true,
      cost: maintenanceCost,
      endDate,
      hours: maintenanceHours,
    };
  },

  // Compléter une maintenance (appelé automatiquement quand le temps est écoulé)
  async completeMaintenance(aircraftId: string, playerId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log(`Completed maintenance for aircraft ${aircraftId} (Player ${playerId})`);
    return true;
  },

  // Vérifier si la maintenance est terminée
  isMaintenanceComplete(maintenanceEndDate: string): boolean {
    return new Date(maintenanceEndDate) <= new Date();
  },

  // Obtenir l'historique de maintenance d'un avion
  async getMaintenanceHistory(_aircraftId: string): Promise<MaintenanceRecord[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    // Mock - sera récupéré du backend
    return [];
  },

  // Créer un record de maintenance
  createMaintenanceRecord(
    aircraftId: string,
    type: 'routine' | 'repair' | 'inspection',
    cost: number,
    flightHours: number,
    description?: string
  ): MaintenanceRecord {
    return {
      id: `maint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      aircraftId,
      date: new Date().toISOString(),
      type,
      cost,
      flightHoursAtMaintenance: flightHours,
      description: description || `${type} maintenance completed`,
    };
  },

  // Vérifier si un avion peut voler (pas en maintenance et condition suffisante)
  canFly(maintenance: AircraftMaintenance): boolean {
    if (maintenance.isUnderMaintenance) {
      return false;
    }

    // Interdiction de vol si condition < 10%
    if (maintenance.condition < 10) {
      return false;
    }

    return true;
  },

  // Obtenir le statut de maintenance d'un avion
  getMaintenanceStatus(maintenance: AircraftMaintenance, aircraft: Aircraft): {
    status: 'good' | 'warning' | 'critical' | 'grounded';
    message: string;
    canFly: boolean;
  } {
    if (maintenance.isUnderMaintenance) {
      const endDate = new Date(maintenance.maintenanceEndDate || '');
      const timeLeft = endDate.getTime() - Date.now();
      const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60));

      return {
        status: 'grounded',
        message: `En maintenance (${hoursLeft}h restantes)`,
        canFly: false,
      };
    }

    if (maintenance.condition < 10) {
      return {
        status: 'grounded',
        message: 'Avion hors service - Maintenance critique requise',
        canFly: false,
      };
    }

    if (maintenance.condition < 30) {
      return {
        status: 'critical',
        message: 'État critique - Maintenance urgente recommandée',
        canFly: true,
      };
    }

    if (maintenance.condition < 60) {
      return {
        status: 'warning',
        message: 'Maintenance recommandée bientôt',
        canFly: true,
      };
    }

    const hoursUntilMaintenance = aircraft.maxFlightHoursBeforeMaintenance - maintenance.flightHours;

    return {
      status: 'good',
      message: `Bon état (${hoursUntilMaintenance}h avant révision)`,
      canFly: true,
    };
  },
};
