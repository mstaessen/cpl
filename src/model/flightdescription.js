var db              = require('../db')
  , Utils           = require('../utils')
  , Airport         = require('./country').findAirport
  , Airline         = require('./airline').Airline.get;

var PeriodCreator = function (args, description) {
    if (!args.validFrom) throw "validFrom not set";
    if (!args.validTo) throw "validTo not set";
    if (!args.datePattern) throw "datePattern not set";
    
    if (args.id) {
        this.period = args;
        this._changed = false;
        print("Loaded FlightDescriptionPeriod with pattern " + args.datePattern +" from " + args.validFrom + " to " + args.validTo + " from database");
    } else {
        if (typeof args.datePattern === 'string') {
            args.datePattern = Utils.parseDatePattern(args.datePattern);
        }
        if (typeof args.validFrom === 'string') {
            args.validFrom = Utils.parseDate(args.validFrom);
        }
        if (typeof args.validTo === 'string') {
            args.validTo = Utils.parseDate(args.validTo);
        }
        
        this.period = db.FlightDescriptionPeriod.build(args, ['validFrom', 'validTo', 'datePattern']);
        db.applyLater(this.period, 'save', []);
        this._changed = true;
        
        print("Created FlightDescriptionPeriod with pattern " + args.datePattern +" from " + args.validFrom + " to " + args.validTo);
    }
    
    this.description = description;
    
    this.prices = new Utils.DBCollection(
        this.period,
        'setPrices',
        db.applyLater,
        []
    );
    
    this.dateExceptions = new Utils.DBCollection(
        this.period,
        'setDateExceptions',
        db.applyLater,
        ['date']
    );
    
    this.flights = new Utils.DBCollection(
        this.period,
        'setFlights',
        db.applyLater,
        ['date']
    );
}

PeriodCreator.prototype.getDO = function() {
    return this.period;
}

PeriodCreator.prototype.checkDO = function(args) {
    if (typeof args.datePattern === 'string') {
        args.datePattern = Utils.parseDatePattern(args.datePattern);
    }
    if (typeof args.validFrom === 'string') {
        args.validFrom = Utils.parseDate(args.validFrom);
    }
    if (typeof args.validTo === 'string') {
        args.validTo = Utils.parseDate(args.validTo);
    }
    
    if (args.validFrom && args.validFrom.getTime() !== this.period.validFrom.getTime()) {
        throw "Valid-from doesn't match for FlightDescriptionPeriod";
    }
    if (args.validTo && args.validTo.getTime() !== this.period.validTo.getTime()) {
        throw "Valid-to doesn't match for FlightDescriptionPeriod";
    }
    if (args.datePattern && args.datePattern !== this.period.datePattern) {
        throw "date pattern doesn't match for FlightDescriptionPeriod";
    }
}

PeriodCreator.prototype.finishLine = function () {
    return this.description.finishLine();
}

PeriodCreator.prototype.Period = function (args) {
    return this.description.Period(args);
}

PeriodCreator.prototype.store = function () {
    // TODO
}

var FlightDescriptionCreator = function(args, pFrom, pTo, pAirline, pAircraftLayout) {
    if (!args.distance) throw "distance not set";
    if (!args.arrivalTime) throw "arrival time not set";
    if (!args.departureTime) throw "departure time not set";
    if (!args.flightNumber) throw "flight number not set";
    
    if (args.id) {
        this.description = args;
        this._changed = false;
        print("description for flight " + args.flightNumber + " loaded from database");
        
        this._from = pFrom; this._to = pTo;
        this._airline = pAirline; this._layout = pAircraftLayout;
    } else {
        if (!args.from) throw "from not set";
        if (!args.to) throw "to not set";
        if (!args.airline) throw "airline not set";
        if (!args.aircraftLayout) throw "aircraft model not set";
        
        this.description = db.FlightDescription.build(args, ['distance', 'flightNumber']);
        this.description.arrivalTime = Utils.parseTime(args.arrivalTime);
        this.description.departureTime = Utils.parseTime(args.departureTime);
        db.applyLater(this.description, 'save', []);
        this._changed = true;
        
        var from, to, airline, layout;
        from = Airport({ code: args.from });
        if (!from) throw "unexistent airport code: " + args.from;
        to = Airport({ code: args.to });
        if (!to) throw "unexistent airport code: " + args.to;
        
        db.applyLater(this.description, 'setFrom', from.airport);
        db.applyLater(this.description, 'setTo', to.airport);
        
        airline = Airline({ code: args.airline });
        if (!airline) throw "unexistent airline code: " + args.airline;
        model = airline.AircraftLayout({name: args.aircraftLayout});
        if (!model) throw "unexistent aircraft model " + args.aircraftLayout + " for airline " + args.airline;
        
        db.applyLater(this.description, 'setAircraftLayout', model.model);
        
        print("description for flight " + args.flightNumber + " loaded from database");
        
        this._from = from; this._to = to;
        this._airline = airline; this._layout = model;
    }
    
    flightDescriptions.push(this);
    
    this.periods = new Utils.DBCollection(
        this.description,
        'setPeriods',
        db.applyLater,
        [
        function (e) {
            return Utils.parseDate(e.validFrom).getTime();
        }
        ]
    );
}

FlightDescriptionCreator.prototype.getDO = function () {
    return this.description;
}

FlightDescriptionCreator.prototype.checkDO = function (args) {
    if (+args.flightNumber !== +this.description.flightNumber) {
        throw "flight numbers don't match";
    }
    if (args.airline !== this._airline.getDO().code) {
        throw "airline doesn't match";
    }
    
    if (args.distance && args.distance !== this.description.distance) {
        throw "distances don't match";
    }
    if (args.arrivalTime 
                && Utils.parseTime(args.arrivalTime).getTime() !== Utils.parseTime(this.description.arrivalTime).getTime()) {
        throw "arrival times don't match";
    }
    if (args.departureTime 
                && Utils.parseTime(args.departureTime).getTime() !== Utils.parseTime(this.description.departureTime).getTime()) {
        throw "departure times don't match";
    }
    
    if (args.from && args.from !== this._from.getDO().code) {
        throw "departure airports don't match";
    }
    if (args.to && args.to !== this._to.getDO().code) {
        throw "arrival airports don't match";
    }
    
    if (args.aircraftLayout && args.aircraftLayout !== this._layout.getDO().name) {
        throw "aircraft layout doesn't match";
    }
}

FlightDescriptionCreator.prototype.finishLine = function () {
    if (this._changed) {
        this.periods.store();
    }
    
    this.periods.forEach(function(e) {
        e.store();
    });
}

FlightDescriptionCreator.prototype.Period = function (args) {
    var period = this.periods.get(args);
    
    if (period) {
        period.checkDO(args);
        return period;
    }
    
    period = new PeriodCreator(args, this);
    this.periods.push(period);
    
    this._changed |= !(args.FlightDescriptionId && args.FlightDescriptionId === this.description.id);
    
    return period;
}

var flightDescriptions = new Utils.MultiIndexedSet(
    [
    function (desc) {
        var airline = desc._airline 
                ? (desc._airline.getDO ? desc._airline.getDO().code : desc._airline.code) 
                : desc.airline;
        var r = airline + "-__-" + desc.flightNumber;
        return r;
    }
    ]
);

module.exports.FlightDescription = function (args, from, to, airline, layout) {
    if (airline) args._airline = airline;
    var desc = flightDescriptions.get(args);
    
    if (desc) {
        desc.checkDO(args);
        return desc;
    }
    
    return new FlightDescriptionCreator(args, from, to, airline, layout);
}