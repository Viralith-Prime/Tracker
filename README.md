# Military Air-Traffic Intelligence System

An unfiltered, real-time military aircraft tracking system built using publicly available ADS-B data. This project implements the API-centric architecture (Blueprint A) from the comprehensive feasibility report, providing free, no-account access to military flight data through community-driven aggregators.

## Features

### Core Functionality
- **Real-time Military Aircraft Tracking**: Live updates from adsb.fi and ADSB.lol APIs
- **Unfiltered Data**: Displays military aircraft not shown on commercial flight trackers
- **Intelligent Categorization**: Automatic identification of fighters, transports, tankers, surveillance aircraft, and helicopters
- **OSINT Enrichment**: Enhanced aircraft information with intelligence assessments

### User Interface
- **Dark Military Theme**: Professional interface optimized for intelligence operations
- **Interactive Map**: Leaflet-based mapping with custom aircraft icons
- **Detailed Aircraft Profiles**: Comprehensive information including research links
- **Advanced Filtering**: Category-based filtering with priority sorting
- **Responsive Design**: Works on desktop and mobile devices

### Intelligence Features
- **Pattern Analysis**: Significance assessment and mission type identification
- **Country Identification**: Automatic detection of operating nations
- **Callsign Analysis**: Military unit and branch identification
- **External Research Links**: Direct links to FlightRadar24, ADS-B Exchange, and aircraft databases

## Technical Architecture

This application implements **Blueprint A: The API-Centric Architecture** as recommended in the feasibility report:

### Data Sources
- **Primary**: adsb.fi public API (`https://opendata.adsb.fi/api/v2/mil`)
- **Fallback**: ADSB.lol public API (`https://api.adsb.lol/v2/mil`)
- **Rate Limits**: Respects 1 request/second for adsb.fi
- **Resilient Design**: Automatic fallback between data sources

### Key Technologies
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Mapping**: Leaflet.js with dark tile layers
- **Data Processing**: Real-time JSON parsing and enrichment
- **Storage**: Local storage for settings persistence

## Installation and Usage

### Quick Start
1. Clone or download this repository
2. Open `index.html` in a modern web browser
3. The application will automatically connect to data sources and begin tracking

### No Dependencies Required
- No account registration needed
- No API keys required
- No server setup necessary
- Works entirely in the browser

### Browser Requirements
- Modern browser with ES6 support (Chrome 60+, Firefox 55+, Safari 12+)
- JavaScript enabled
- Internet connection for data fetching

## Understanding the Data

### What You Will See
Based on the principle of "transponder discipline," the aircraft visible on this tracker include:

- **Transport Aircraft**: C-130 Hercules, C-17 Globemaster III, A400M Atlas
- **Tanker Aircraft**: KC-135 Stratotanker, KC-10 Extender, A330 MRTT
- **Surveillance Aircraft**: P-8 Poseidon, E-3 AWACS, RC-135 Rivet Joint
- **Training Aircraft**: T-38 Talon, T-6 Texan II
- **VIP Transport**: Government and military executive aircraft
- **Some Fighter Aircraft**: During training or transit operations

### What You Will NOT See
- Combat aircraft on active missions
- Aircraft in hostile or contested airspace
- Special operations flights
- Aircraft deliberately operating "dark" for OPSEC reasons

### Intelligence Context
The visibility of military aircraft is **intentional**. Aircraft choose to broadcast their positions for:
- Legal compliance in civilian airspace
- Air traffic separation
- Power projection and deterrence
- Training and routine operations

## Features Overview

### Real-time Tracking
- Updates every 10 seconds (configurable)
- Automatic stale aircraft removal
- Live position updates with heading indication

### Aircraft Categories
- **Fighters** ✈️: Combat and attack aircraft
- **Transports** 🛫: Cargo and personnel transport
- **Tankers** ⛽: Aerial refueling aircraft
- **Surveillance** 📡: Intelligence and reconnaissance
- **Helicopters** 🚁: Rotary-wing aircraft
- **Special Operations** ⚡: Specialized mission aircraft
- **VIP Transport** 👑: High-value personnel transport

### Intelligence Assessment
Each aircraft receives an automated intelligence assessment including:
- **Significance Rating**: 1-5 scale based on strategic importance
- **Mission Type Analysis**: Probable mission based on aircraft type and patterns
- **Operational Notes**: Contextual intelligence indicators

### OSINT Research Integration
Direct links to external research sources:
- **ADS-B Exchange**: Unfiltered flight history
- **FlightRadar24**: Commercial tracking data
- **FAA Registry**: Aircraft registration information
- **JetPhotos**: Aircraft photography database
- **PlaneSpotters**: Detailed aircraft specifications

## Settings and Customization

### Update Intervals
- 5, 10, 15, or 30-second refresh rates
- Automatic rate limiting compliance
- Background update management

### Data Source Selection
- Primary source selection (adsb.fi or ADSB.lol)
- Automatic fallback capability
- Source status indication

### Display Options
- Category filtering
- Map centering controls
- Future: Flight trail tracking
- Future: Label display options

## Legal and Ethical Considerations

### Public Data Sources
This application uses only **publicly broadcast** ADS-B signals aggregated by community-driven networks. All data is:
- Transmitted voluntarily by aircraft
- Aggregated by volunteer networks
- Available through public APIs
- Unencrypted and openly accessible

### OSINT Compliance
The system operates within the framework of Open Source Intelligence (OSINT):
- No classified information is accessed
- No systems are infiltrated or compromised
- All data sources are publicly available
- Research links connect to legitimate databases

### Responsible Use
Users should:
- Understand the voluntary nature of the data
- Respect operational security considerations
- Use information for educational purposes
- Avoid interfering with military operations

## Future Enhancements

### Planned Features
- **Flight Trail Tracking**: Historical path visualization
- **Pattern Analysis**: Long-term operational pattern identification
- **Geographic Analysis**: Regional activity monitoring
- **Alert System**: Notification of significant aircraft appearances
- **Export Capabilities**: Data export for analysis

### Advanced OSINT Features
- **Historical Analysis**: Long-term pattern identification
- **Geographic Correlation**: Regional activity analysis
- **Unit Identification**: Enhanced military unit recognition
- **Mission Pattern Recognition**: Automated operational analysis

## Technical Implementation Details

### API Integration
```javascript
// Example API call to adsb.fi
const response = await fetch('https://opendata.adsb.fi/api/v2/mil');
const data = await response.json();
```

### Data Structure
Aircraft objects include:
- **hex**: ICAO 24-bit identifier
- **flight**: Callsign
- **lat/lon**: Position coordinates
- **alt_baro**: Barometric altitude
- **gs**: Ground speed
- **track**: Heading
- **t**: Aircraft type

### Enrichment Process
1. **Type Identification**: Aircraft type database lookup
2. **Category Assignment**: Fighter, transport, tanker, etc.
3. **Callsign Analysis**: Country and unit identification
4. **Intelligence Assessment**: Significance and mission analysis
5. **Research Link Generation**: External database connections

## Troubleshooting

### Common Issues
- **No aircraft visible**: Check internet connection and wait for data refresh
- **Map not loading**: Verify JavaScript is enabled
- **Settings not saving**: Check browser local storage permissions

### Data Source Issues
- **Connection failed**: Application will automatically try fallback source
- **Rate limiting**: Built-in delays prevent API overuse
- **No data returned**: May indicate low military activity in current timeframe

## Contributing

This project is designed as a complete, standalone implementation. Potential contributions:
- Additional aircraft type identification
- Enhanced callsign pattern recognition
- Improved intelligence assessment algorithms
- Additional OSINT data source integration

## License

This project is provided for educational and research purposes. Users are responsible for compliance with local laws and regulations regarding the use of publicly available aviation data.

## Acknowledgments

- **Community Data Providers**: adsb.fi and ADSB.lol for providing free, unfiltered data access
- **ADS-B Exchange**: Pioneer in unfiltered flight tracking
- **OpenStreetMap**: Base mapping data
- **Leaflet.js**: Interactive mapping library
- **Aviation Community**: Volunteers operating ADS-B receivers worldwide

---

*This system demonstrates the power of Open Source Intelligence (OSINT) and the transparency enabled by modern aviation technology. It serves as an educational tool for understanding military aviation operations and the strategic implications of voluntary data transmission.*