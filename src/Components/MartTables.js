import React from 'react'
import { styled } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

function MartTables({ marttables }) {

    // Display name mappings for table names (frontend only)
    const tableDisplayNameMappings = {
        'CampaignLeads': 'MarketingEngagements',
        'AssetLeads': 'ContentEngagements',
        'TempAzureConsumedRevenue': 'TempUsageMetrics',
        'TempFieldRevenueAccountability': 'TempFinancialMetrics'
    };

    // Helper function to get display name for a table
    const getTableDisplayName = (tableName) => {
        if (!tableName) return tableName;
        const parts = tableName.split('.');
        const simpleTableName = parts[parts.length - 1];
        if (tableDisplayNameMappings[simpleTableName]) {
            parts[parts.length - 1] = tableDisplayNameMappings[simpleTableName];
            return parts.join('.');
        }
        return tableName;
    };

    const StyledTableCell = styled(TableCell)(({ theme }) => ({
        [`&.${tableCellClasses.head}`]: {
            backgroundColor: theme.palette.common.black,
            color: theme.palette.common.white,
        },
        [`&.${tableCellClasses.body}`]: {
            fontSize: 14,
        },
    }));

    const StyledTableRow = styled(TableRow)(({ theme }) => ({
        '&:nth-of-type(odd)': {
            backgroundColor: theme.palette.action.hover,
        },
        // hide last border
        '&:last-child td, &:last-child th': {
            border: 0,
        },
    }));

    // const [marttables, setMarttables] = useState([
    //     {
    //         "tablename": "PartnerOneIDCACR",
    //         "databasename": "GPSMart_CPA",
    //         "tabletype": "Created table",
    //         "ColumnUsed": "RPO.PartnerOneID, RPO.PartnerSegment, RPO.PartnerSubSegment, PS.IsDefinitiveISV, PS.IsHumanVerifiedISV, PS.IsSelfIdentifiedISV, PS.IsSuspectedISV, PS.IsIAMCP, PS.IsTelco, PS.IsBuildfor2030, PS.CLASDownloads, RPO.IsManaged, RPO.IsGlobalChannel, RPO.IsGlobalISV, RPO.IsGSI, RPO.IsStrategicServices, RPO.IsStrategicISV, RPO.IsStrategicLSP, RPO.IsStrategicDistributor, RPO.IsQuestionablePartner, RPO.IsStrategic, RPO.IsSI, RPO.IsLSP, RPO.IsAdvisory, RPO.IsHoster, RPO.IsMSP, RPO.IsTelcoPartner, RPO.IsTelcoOperator, RPO.IsDistributor",
    //         "Stagingtableused": "GPSStaging_CPA.exceldata, GPSStaging_CPA.DimPartner, GPSStaging_CPA.ReportingPartnerOneCACR, OCPStaging_Digital.Partner_Segment"
    //     }
    // ]);

    return (
        <div>

            {marttables.length === 0 ?
                <>
                    <p style={{ width: "100%", textAlign: "center", fontSize: "20px" }}>No mart tables are created in the files.</p>
                </>

                :

                <>
                    <TableContainer>
                        <Table sx={{ minWidth: 700 }} aria-label="customized table">
                            <TableHead>
                                <TableRow>
                                    <StyledTableCell>Table Name</StyledTableCell>
                                    <StyledTableCell>Database Name</StyledTableCell>
                                    <StyledTableCell>Table Type</StyledTableCell>
                                    {/* <StyledTableCell>Columns Used</StyledTableCell> */}
                                    <StyledTableCell>Staging Tables Used</StyledTableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody >
                                {marttables.map((row) => (
                                    <StyledTableRow key={row.name}>
                                        <StyledTableCell component="th" scope="row">
                                            {getTableDisplayName(row.tablename)}
                                        </StyledTableCell>
                                        <StyledTableCell align="right">{row.databasename}</StyledTableCell>
                                        <StyledTableCell align="right">{row.tabletype}</StyledTableCell>
                                        {/* <StyledTableCell align="right">{Array.isArray(row.ColumnUsed) ? row.ColumnUsed.join(', ') : row.ColumnUsed}</StyledTableCell> */}
                                        <StyledTableCell align="right">{Array.isArray(row.Stagingtableused) ? row.Stagingtableused.map(t => getTableDisplayName(t)).join(', ') : getTableDisplayName(row.Stagingtableused)}</StyledTableCell>
                                    </StyledTableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </>
            }
        </div>
    )
}

export default MartTables
