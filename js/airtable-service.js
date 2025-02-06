class AirtableService {
    constructor() {
        if (typeof Airtable === 'undefined') {
            throw new Error('Airtable library not loaded');
        }
        
        try {
            this.base = new Airtable({
                apiKey: 'patSM7srrQNAGryRf.b044624fb90f100f1f4bd7efda8f40f4176863ef1b9206aeeff78e2e6437f2e9'
            }).base('appuI5cRKzcI7c86H');
        } catch (error) {
            console.error('Error initializing Airtable:', error);
            throw error;
        }
    }

    async getReservations() {
        try {
            // Get today's date in ISO format
            const now = new Date();
            const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
            const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();

            // Create filter formula
            const filterFormula = `AND(
                IS_AFTER({DateandTime}, '${startOfDay}'),
                IS_BEFORE({DateandTime}, '${endOfDay}')
            )`;

            const records = await this.base('Reservation')
                .select({
                    filterByFormula: filterFormula
                })
                .all();

            return records.map(record => ({
                id: record.id,
                tableId: record.get('Table'),
                time: record.get('DateandTime'),
                status: record.get('Reservation Type') === 'Phone call' ? 'phone-call' : 'walk-in',
                customerName: record.get('Notes'),
                pax: record.get('Pax'),
                reservationType: record.get('Reservation Type') === 'Phone call' ? 'phone' : 'walk-in'
            }));
        } catch (error) {
            console.error('Error fetching reservations:', error);
            return [];
        }
    }

    async createWalkInReservation(tableId, dateTime) {
        try {
            console.log('Creating walk-in reservation:', { tableId, dateTime });
            
            const walkInData = {
                fields: {
                    "Table": `Table ${tableId}`,
                    "DateandTime": dateTime.toISOString(),
                    "Status": "Walk in",
                    "Reservation Type": "Google Sheet"
                }
            };

            const record = await this.base('Reservation').create([walkInData]);
            console.log('Created walk-in reservation:', record);
            return record;
        } catch (error) {
            console.error('Detailed error:', error);
            throw error;
        }
    }

    async updateReservationStatus(recordId, status) {
        try {
            await this.base('Reservation').update(recordId, {
                'Status': status,
                'Reservation Type': 'Phone call'
            });
        } catch (error) {
            console.error('Error updating reservation:', error);
            throw error;
        }
    }
} 