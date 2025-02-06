// Wait for all scripts to load
window.addEventListener('load', function() {
    // Initialize AirtableService
    let airtableService;
    try {
        airtableService = new AirtableService();
        // Make airtableService globally available
        window.airtableService = airtableService;
        console.log('AirtableService initialized successfully');
    } catch (error) {
        console.error('Failed to initialize AirtableService:', error);
    }
    
    // Generate time slots for each table
    function generateTimeSlots() {
        const slots = [];
        for (let hour = 9; hour <= 21; hour++) {
            slots.push({
                time: `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`,
                status: 'available'
            });
        }
        return slots;
    }

    // Initialize tables
    const tables = Array.from({ length: 10 }, (_, i) => ({
        id: (i + 1).toString(),
        name: `Table ${i + 1}`,
        timeSlots: generateTimeSlots()
    }));

    // Reset tables daily at midnight
    function resetTablesDaily() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const timeUntilMidnight = tomorrow.getTime() - now.getTime();
        
        setTimeout(() => {
            // Reset all tables to initial state
            document.getElementById('tables-container').innerHTML = 
                tables.map(table => ({
                    ...table,
                    timeSlots: generateTimeSlots()
                })).map(table => renderTable(table)).join('');
            
            // Set up next day's reset
            resetTablesDaily();
        }, timeUntilMidnight);
    }

    // Start the daily reset cycle
    resetTablesDaily();

    // Fetch and update reservations periodically
    async function fetchAndUpdateReservations() {
        if (!window.airtableService) return;

        try {
            const reservations = await window.airtableService.getReservations();
            if (reservations.length > 0) {
                // Update tables with reservation data
                tables.forEach(table => {
                    const tableReservations = reservations.filter(
                        res => res.tableId === table.name || res.tableId === `Table ${table.id}`
                    );
                    
                    table.timeSlots.forEach(slot => {
                        const reservation = tableReservations.find(res => {
                            if (!res.time || typeof res.time !== 'string') return false;
                            const resDate = new Date(res.time);
                            const slotTime = slot.time.split(' - ')[0];
                            const [hours] = slotTime.split(':');
                            return resDate.getHours() === parseInt(hours);
                        });

                        if (reservation) {
                            slot.status = reservation.status;
                            slot.customerName = reservation.customerName;
                            slot.pax = reservation.pax;
                        }
                    });
                });

                // Update the UI
                document.getElementById('tables-container').innerHTML = 
                    tables.map(table => renderTable(table)).join('');
            }
        } catch (error) {
            console.error('Error fetching reservations:', error);
        }
    }

    // Initial fetch and start periodic updates
    fetchAndUpdateReservations();
    setInterval(fetchAndUpdateReservations, 30000); // Update every 30 seconds

    // Render table time slots
    function renderTable(table) {
        return `
            <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
                <div class="card h-100">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">${table.name}</h5>
                    </div>
                    <div class="card-body p-0">
                        <div class="list-group list-group-flush">
                            ${table.timeSlots.map((slot) => `
                                <div class="list-group-item ${
                                    slot.status === 'phone-call' ? 'bg-danger-subtle' :
                                    slot.status === 'walk-in' ? 'bg-info-subtle' :
                                    ''
                                }">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <small>${slot.time}</small>
                                        <select class="form-select form-select-sm" 
                                                style="width: 120px"
                                                data-table-id="${table.id}"
                                                data-time-slot="${slot.time}"
                                                onchange="handleStatusChange(event)">
                                            <option value="available" ${slot.status === 'available' ? 'selected' : ''}>Available</option>
                                            <option value="walk-in" ${slot.status === 'walk-in' ? 'selected' : ''}>Walk-in</option>
                                            <option value="phone-call" ${slot.status === 'phone-call' ? 'selected' : ''}>Phone Call</option>
                                        </select>
                                    </div>
                                    ${(slot.status === 'phone-call' || slot.status === 'walk-in') && slot.customerName ? `
                                        <div class="d-flex justify-content-between align-items-center mt-1">
                                            <small class="text-muted">
                                                ${slot.status === 'phone-call' ? 'Phone call' : 'Walk in'}
                                            </small>
                                            <small class="text-muted">
                                                ${slot.customerName} (${slot.pax} pax)
                                            </small>
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Update date and time
    function updateDateTime() {
        const now = new Date();
        document.getElementById('current-time').textContent = 
            now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        document.getElementById('current-date').textContent = 
            now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Handle status change
    window.handleStatusChange = async function(event) {
        const select = event.target;
        const tableId = select.dataset.tableId;
        const timeSlot = select.dataset.timeSlot;
        const newStatus = select.value;

        try {
            const tableIndex = tables.findIndex(t => t.id === tableId);
            if (tableIndex !== -1) {
                const slotIndex = tables[tableIndex].timeSlots.findIndex(s => s.time === timeSlot);
                if (slotIndex !== -1) {
                    tables[tableIndex].timeSlots[slotIndex].status = newStatus;
                    
                    // Create walk-in reservation
                    if (newStatus === 'walk-in' && window.airtableService) {
                        const [startTime] = timeSlot.split(' - ');
                        const [hours, minutes] = startTime.split(':');
                        
                        const today = new Date();
                        const dateTime = new Date(
                            today.getFullYear(),
                            today.getMonth(),
                            today.getDate(),
                            parseInt(hours),
                            parseInt(minutes)
                        );

                        try {
                            console.log('Attempting to create walk-in reservation...');
                            await window.airtableService.createWalkInReservation(tableId, dateTime);
                            console.log('Successfully created walk-in reservation');
                        } catch (error) {
                            console.error('Failed to create walk-in reservation:', error);
                        }
                    } else if (newStatus === 'walk-in') {
                        console.error('AirtableService not initialized');
                    }

                    document.getElementById('tables-container').innerHTML = 
                        tables.map(table => renderTable(table)).join('');
                }
            }
        } catch (error) {
            console.error('Error updating reservation:', error);
            alert('Failed to update reservation');
        }
    };

    // Initialize the page
    function initialize() {
        // Render initial tables
        document.getElementById('tables-container').innerHTML = 
            tables.map(table => renderTable(table)).join('');

        // Start date/time updates
        updateDateTime();
        setInterval(updateDateTime, 1000);

        // Start periodic reservation updates if Airtable is available
        if (airtableService) {
            async function updateReservations() {
                try {
                    const reservations = await airtableService.getReservations();
                    if (reservations.length > 0) {
                        reservations.forEach(reservation => {
                            const tableId = reservation.tableId.replace('Table ', '');
                            const tableIndex = tables.findIndex(t => t.id === tableId);
                            
                            if (tableIndex !== -1) {
                                const resDate = new Date(reservation.time);
                                const hours = resDate.getHours();
                                
                                const slotIndex = tables[tableIndex].timeSlots.findIndex(slot => {
                                    const [slotTime] = slot.time.split(' - ');
                                    const [slotHours] = slotTime.split(':');
                                    return parseInt(slotHours) === hours;
                                });

                                if (slotIndex !== -1) {
                                    tables[tableIndex].timeSlots[slotIndex] = {
                                        ...tables[tableIndex].timeSlots[slotIndex],
                                        status: reservation.status,
                                        customerName: reservation.customerName,
                                        pax: reservation.pax
                                    };
                                }
                            }
                        });

                        document.getElementById('tables-container').innerHTML = 
                            tables.map(table => renderTable(table)).join('');
                    }
                } catch (error) {
                    console.error('Error updating reservations:', error);
                }
            }

            updateReservations();
            setInterval(updateReservations, 30000); // Update every 30 seconds
        }
    }

    // Start the application
    initialize();
});