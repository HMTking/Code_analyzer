import * as React from 'react';
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TableDetails from './TableDetails';
import MountsTable from './MountsTable';
import MartTables from './MartTables';
import StagingTables from './StagingTables';

function CustomTabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
            style={{ overflow: 'auto' }}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    <Typography>{children}</Typography>
                </Box>
            )}
        </div>
    );
}

CustomTabPanel.propTypes = {
    children: PropTypes.node,
    index: PropTypes.number.isRequired,
    value: PropTypes.number.isRequired,
};

function a11yProps(index) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

function TabsC({ mounts, extractedtables, staticcreated, marttables, stagingtables }) {

    const [value, setValue] = React.useState(0);

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    // const [staticcreated, setStaticcreated] = React.useState({
    //     "databasecreated": ["GPSMart_CPA", "GPSStaging_CPA"],
    //     "tablescreated": ["CPAAccessList", "USAGETRACKERCACR"]
    // });

    return (
        <div>
            <Box sx={{ width: '100%' }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider', margin: "3rem 3rem", marginBottom: "0rem" }}>
                    <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
                        <Tab label="Database created" {...a11yProps(0)} />
                        <Tab label="Static tables created" {...a11yProps(1)} />
                        <Tab label="Mounts Created" {...a11yProps(2)} />
                        <Tab label="Staging Tables" {...a11yProps(3)} />
                        <Tab label="Mart Table" {...a11yProps(4)} />
                        {/* <Tab label="Staging Tables Details" {...a11yProps(5)} /> */}
                    </Tabs>
                </Box>


                <CustomTabPanel value={value} index={0} sx={{ display: "block", marginLeft: "auto" }}>
                    {
                        staticcreated.databasecreated.length === 0 ?
                            <p style={{ width: "100%", textAlign: "center", fontSize: "20px" }}>No Database are created in the files.</p>
                            :
                            <>
                                <p style={{ width: "100%", textAlign: "center", fontSize: "20px" }}>Databases created in the files -</p>
                                {staticcreated.databasecreated.map((database) => (
                                    <p style={{ width: "100%", textAlign: "center" }}>{database}</p>
                                ))}
                            </>
                    }
                </CustomTabPanel>
                <CustomTabPanel value={value} index={1}>
                    {/* <p style={{ width: "100%", textAlign: "center", fontSize: "20px" }}>Static tables created in the files -</p>
                    {staticcreated.tablescreated.map((database) => (
                        <p style={{ width: "100%", textAlign: "center" }}>{database}</p>
                    ))} */}

                    {
                        staticcreated.tablescreated.length === 0 ?
                            <p style={{ width: "100%", textAlign: "center", fontSize: "20px" }}>No Static tables are created in the files.</p>
                            :
                            <>
                                <p style={{ width: "100%", textAlign: "center", fontSize: "20px" }}>Static tables created in the files -</p>
                                {staticcreated.tablescreated.map((database) => (
                                    <p style={{ width: "100%", textAlign: "center" }}>{database}</p>
                                ))}
                            </>
                    }
                </CustomTabPanel>
                <CustomTabPanel value={value} index={2} >
                    <MountsTable mounts={mounts} />
                </CustomTabPanel>
                <CustomTabPanel value={value} index={3}>
                    <TableDetails extractedtables={extractedtables} />
                </CustomTabPanel>
                <CustomTabPanel value={value} index={4}>
                    <MartTables marttables={marttables} />
                </CustomTabPanel>
                {/* <CustomTabPanel value={value} index={5}>
                    <StagingTables stagingtables={stagingtables} />
                </CustomTabPanel> */}
            </Box>
        </div>
    )
}

export default TabsC
