import React, { useEffect, useState } from 'react'
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import DownloadIcon from '@mui/icons-material/Download';
import { Tooltip } from '@mui/material';
import XLSX from 'xlsx-js-style';
import logo from "../Images/Logo.png"

function NavbarEnhanced(
    { pipelines, bronzeDetails, silverDetails, goldDetails, stagingtables, loading, flagpage }
) {

    // Check if Fabric Enhanced processing happened in this session
    const isFabricEnhancedSessionActive = () => {
        return sessionStorage.getItem('fabricEnhancedSessionProcessed') === 'true';
    };

    // Check if Databricks processing happened in this session
    const isDatabricksSessionActive = () => {
        return sessionStorage.getItem('codeAnalyzerSessionProcessed') === 'true';
    };

    // Check if Fabric Enhanced lineage data exists in localStorage
    const checkFabricEnhancedLineageData = () => {
        try {
            if (!isFabricEnhancedSessionActive()) return false;
            const stored = localStorage.getItem('fabricEnhancedOutput');
            if (!stored) return false;
            const data = JSON.parse(stored);
            if (data?.goldDetails?.length > 0 || data?.silverDetails?.length > 0) {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    };

    // Check if Databricks lineage data exists in localStorage
    const checkDatabricksLineageData = () => {
        try {
            if (!isDatabricksSessionActive()) return false;
            const stored = localStorage.getItem('codeAnalyzerOutput');
            if (!stored) return false;
            const data = JSON.parse(stored);
            const repos = data?.Repos;
            if (!repos) return false;
            for (const repoKey of Object.keys(repos)) {
                const repo = repos[repoKey];
                if (repo?.MartTables?.length > 0 || repo?.StagingTable?.length > 0) {
                    return true;
                }
            }
            return false;
        } catch (e) {
            return false;
        }
    };

    // Check for prop-based data as well
    const hasPropData = goldDetails?.length > 0 || silverDetails?.length > 0;
    const [hasFabricLineageData, setHasFabricLineageData] = useState(checkFabricEnhancedLineageData() || hasPropData);
    const [hasDatabricksLineageData, setHasDatabricksLineageData] = useState(checkDatabricksLineageData());

    useEffect(() => {
        const handleFabricDataUpdated = () => {
            setHasFabricLineageData(checkFabricEnhancedLineageData());
        };
        const handleDatabricksDataUpdated = () => {
            setHasDatabricksLineageData(checkDatabricksLineageData());
        };
        window.addEventListener('fabricEnhancedDataUpdated', handleFabricDataUpdated);
        window.addEventListener('codeAnalyzerDataUpdated', handleDatabricksDataUpdated);
        window.addEventListener('storage', () => {
            handleFabricDataUpdated();
            handleDatabricksDataUpdated();
        });
        return () => {
            window.removeEventListener('fabricEnhancedDataUpdated', handleFabricDataUpdated);
            window.removeEventListener('codeAnalyzerDataUpdated', handleDatabricksDataUpdated);
        };
    }, []);

    // Update when props change
    useEffect(() => {
        if (goldDetails?.length > 0 || silverDetails?.length > 0) {
            setHasFabricLineageData(true);
        }
    }, [goldDetails, silverDetails]);

    const showDatabricksLineageView = hasDatabricksLineageData;
    const showFabricLineageView = flagpage === 3 || hasFabricLineageData;

    const baseNavItems = [
        { label: 'Home', href: '/' },
        { label: 'Data Analysis - Fabric Enhanced', href: '/v2' },
    ];

    // Build nav items with lineage view before POSOT Data Explorer
    let navItems = [...baseNavItems];
    if (showFabricLineageView && !loading) {
        navItems.push({ label: 'Fabric Lineage View', href: '/v2/fabricenhancedlineage' });
    }
    navItems.push({ label: 'POSOT Data Explorer', href: '/v2/repoexplorer' });

    const LogoHeader = () => (
        <Box sx={{ textAlign: 'center', backgroundColor: '#f5f5f5', padding: "10px 0px 1px 0px" }}>
            <a href="/">
                <img
                    src={logo} // Replace with actual logo path
                    alt="Code Analyzer Logo"
                    style={{ height: '70px', objectFit: 'contain' }}
                />
            </a>
        </Box>
    );

    // const pipelines = [
    //     {
    //         "TableName": "",
    //         "Path": "",
    //         "SQLConnection": "@activity('GetConfiguration').output.firstRow.SQLconnectionstring",
    //         "SourceDetails": "DataWarehouseSource",
    //         "DumpLocation": "",
    //         "Columns": ["PipelineName", "StreamName", "StageName"],
    //         "filepathname": "Pipelines/Tealium_Datapull.DataPipeline/pipeline-content.json"
    //     },
    //     {
    //         "TableName": "",
    //         "Path": "JSON/ConfigurationJSON/DigitalMaster.json",
    //         "SQLConnection": "@activity('GetConfiguration').output.firstRow.SQLconnectionstring",
    //         "SourceDetails": "Lakehouse",
    //         "DumpLocation": "Files",
    //         "Columns": ["PipelineName", "StreamName", "StageName"],
    //         "filepathname": "Pipelines/PMC_DataPull.DataPipeline/pipeline-content.json"
    //     }
    // ]

    // const bronzeDetails = [
    //     {
    //         "tablename": "DMCInventory",
    //         "SchemaDump": "",
    //         "Source": "SharePoint Files",
    //         "TableUsed":[ "ThruPM CaiB Inventory.xlsx"],
    //         "filepathname": "Digital (5)/Digital/Bronze/Data Flow/GTMM_Dataflow_ThruPartnerMapping.Dataflow/mashup.pq"
    //     },
    //     {
    //         "tablename": "PMC Inventory",
    //         "SchemaDump": "",
    //         "Source": "SharePoint Files",
    //         "TableUsed": ["ThruPM CaiB Inventory.xlsx"],
    //         "filepathname": "Digital (5)/Digital/Bronze/Data Flow/GTMM_Dataflow_ThruPartnerMapping.Dataflow/mashup.pq"
    //     },
    //     {
    //         "tablename": "Query",
    //         "SchemaDump": "",
    //         "Source": "SharePoint.Files",
    //         "TableUsed": [],
    //         "filepathname": "Digital (5)/Digital/Bronze/Data Flow/GTMM_DataFlow_JumpStart.Dataflow/mashup.pq"
    //     },
    //     {
    //         "tablename": "Query_DataDestination",
    //         "SchemaDump": "",
    //         "Source": "Lakehouse.Contents",
    //         "TableUsed": [],
    //         "filepathname": "Digital (5)/Digital/Bronze/Data Flow/GTMM_DataFlow_JumpStart.Dataflow/mashup.pq"
    //     }
    // ]
    // const silverDetails = [
    //     {
    //         "tablename": "All_Events_Raw_Historical_Intermediate",
    //         "SchemaDump": "",
    //         "Tablesused": ["Bronze.Bronze_All_Events_Raw_Historical"],
    //         "ColumnUsed": [
    //             "VisitorID",
    //             "firstpartycookies_utag_main_ses_id",
    //             "original_pageurl_full_url",
    //             "pageurl_full_url",
    //             "original_pageurl_path",
    //             "pageurl_path",
    //             "pageurl_domain",
    //             "udo_channel_closer",
    //             "eventtime",
    //             "Eventdate",
    //             "original_pageurl_querystring",
    //             "ori_pageurl_querystring",
    //             "pageurl_querystring",
    //             "pageurl_querystring_persisted",
    //             "pageurl_querystring_nonpersisted",
    //             "original_referrerurl_full_url",
    //             "referrerurl_full_url",
    //             "referrerurl_domain",
    //             "ReferrerChannel",
    //             "ReferrerChannelWTMCID",
    //             "ChannelInfo",
    //             "original_udo_event_name",
    //             "udo_event_name",
    //             "udo_event_type",
    //             "udo_event_action",
    //             "udo_event_offer",
    //             "udo_click_category",
    //             "original_udo_event_target",
    //             "udo_event_target",
    //             "original_udo_event_title",
    //             "udo_event_title",
    //             "udo_event_attr1",
    //             "udo_event_attr2",
    //             "udo_event_attr3",
    //             "original_udo_event_attr4",
    //             "udo_event_attr4",
    //             "firstpartycookies__mkto_trk",
    //             "udo_partner_id",
    //             "udo_ut_event",
    //             "udo_partner_mpn_id",
    //             "original_udo_link_name",
    //             "udo_link_name",
    //             "udo_page_title",
    //             "udo_event_area",
    //             "Cookies_modified",
    //             "LocaleName",
    //             "DataMartExploration",
    //             "GlobalPageURL",
    //             "GlobalReferrerURL",
    //             "GlobalTargetURL",
    //             "PartnerID",
    //             "MPNPartnerID",
    //             "SessionID",
    //             "PracticeArea",
    //             "SearchTerm",
    //             "AssetName",
    //             "udo_partner_authtype",
    //             "original_udo_feedback_comments",
    //             "udo_feedback_comments",
    //             "udo_partner_seller_id",
    //             "udo_comscore_resp_id",
    //             "udo_demandbase_sid",
    //             "udo_db_sub_industry",
    //             "udo_db_revenue_range",
    //             "udo_db_industry",
    //             "udo_db_employee_range",
    //             "udo_db_audience_segment",
    //             "udo_db_audience",
    //             "udo_task_cta_id",
    //             "udo_partnercenter_id",
    //             "udo_data_bi_id",
    //             "udo_db_company_name",
    //             "udo_blade_name",
    //             "udo_personalized_blade_type",
    //             "udo_personalized_blade_rule",
    //             "udo_personalized_blade_name",
    //             "udo_oem_maascompany",
    //             "udo_oem_maascompany_id",
    //             "Updated_oem_maascompany",
    //             "Updated_oem_maascompany_id",
    //             "udo_filter_value",
    //             "udo_filter_category",
    //             "udo_search_results",
    //             "udo_cd_asset_id",
    //             "original_udo_search_term",
    //             "udo_search_term",
    //             "udo_blade_type",
    //             "udo_wt_mc_id",
    //             "MonthYear"
    //         ],
    //         "filepathname": "Digital (5)/Digital/Silver/Digital_Silver_All_Events_Raw_Historical.Notebook/notebook-content.py"
    //     },
    //     {
    //         "tablename": "All_Events_Raw_Digital_df",
    //         "SchemaDump": "",
    //         "Tablesused": ["Bronze.Bronze_All_Events_Raw_Digital"],
    //         "ColumnUsed": [
    //             "VisitorID",
    //             "firstpartycookies_utag_main_ses_id",
    //             "original_pageurl_full_url",
    //             "pageurl_full_url",
    //             "original_pageurl_path",
    //             "pageurl_path",
    //             "pageurl_domain",
    //             "udo_channel_closer",
    //             "eventtime",
    //             "Eventdate",
    //             "original_pageurl_querystring",
    //             "ori_pageurl_querystring",
    //             "pageurl_querystring",
    //             "pageurl_querystring_persisted",
    //             "pageurl_querystring_nonpersisted",
    //             "original_referrerurl_full_url",
    //             "referrerurl_full_url",
    //             "referrerurl_domain",
    //             "ReferrerChannel",
    //             "ReferrerChannelWTMCID",
    //             "ChannelInfo",
    //             "original_udo_event_name",
    //             "udo_event_name",
    //             "udo_event_type",
    //             "udo_event_action",
    //             "udo_event_offer",
    //             "udo_click_category",
    //             "original_udo_event_target",
    //             "udo_event_target",
    //             "original_udo_event_title",
    //             "udo_event_title",
    //             "udo_event_attr1",
    //             "udo_event_attr2",
    //             "udo_event_attr3",
    //             "original_udo_event_attr4",
    //             "udo_event_attr4",
    //             "firstpartycookies__mkto_trk",
    //             "udo_partner_id",
    //             "udo_ut_event",
    //             "udo_partnerId",
    //             "original_udo_link_name",
    //             "udo_link_name",
    //             "udo_page_title",
    //             "udo_event_area",
    //             "Cookies_modified",
    //             "LocaleName",
    //             "DataMartExploration",
    //             "GlobalPageURL",
    //             "GlobalReferrerURL",
    //             "GlobalTargetURL",
    //             "PartnerID",
    //             "Partner_ID",
    //             "SessionID",
    //             "PracticeArea",
    //             "SearchTerm",
    //             "AssetName",
    //             "udo_partner_authtype",
    //             "original_udo_feedback_comments",
    //             "udo_feedback_comments",
    //             "udo_partner_seller_id",
    //             "udo_comscore_resp_id",
    //             "udo_demandbase_sid",
    //             "udo_db_sub_industry",
    //             "udo_db_revenue_range",
    //             "udo_db_industry",
    //             "udo_db_employee_range",
    //             "udo_db_audience_segment",
    //             "udo_db_audience",
    //             "udo_task_cta_id",
    //             "udo_partnercenter_id",
    //             "udo_data_bi_id",
    //             "udo_db_company_name",
    //             "udo_blade_name",
    //             "udo_personalized_blade_type",
    //             "udo_personalized_blade_rule",
    //             "udo_personalized_blade_name",
    //             "udo_oem_maascompany",
    //             "udo_oem_maascompany_id",
    //             "Updated_oem_maascompany",
    //             "Updated_oem_maascompany_id",
    //             "udo_filter_value",
    //             "udo_filter_category",
    //             "udo_search_results",
    //             "udo_cd_asset_id",
    //             "original_udo_search_term",
    //             "udo_search_term",
    //             "udo_blade_type",
    //             "udo_wt_mc_id",
    //             "MonthYear"
    //         ],
    //         "filepathname": "Digital (5)/Digital/Silver/Digital_Silver_All_Events_Raw_Historical.Notebook/notebook-content.py"
    //     },
    //     {
    //         "tablename": "Silver_Specialization",
    //         "SchemaDump": "",
    //         "Tablesused": ["Bronze/FactPartnerSpecialization, Bronze/DimPartner"],
    //         "ColumnUsed": [
    //             "PartnerGlobalID",
    //             "EnrollmentStartDate",
    //             "SpecializationName",
    //             "SpecializationStatus",
    //             "MembershipStatus"
    //         ],
    //         "filepathname": "Digital (5)/Digital/Silver/CPA_Silver_Specialization.Notebook/notebook-content.py"
    //     },
    //     {
    //         "tablename": "All_Events_Raw",
    //         "SchemaDump": "",
    //         "Tablesused": ["Bronze.All_Events_Raw"],
    //         "ColumnUsed": [
    //             "VisitorID",
    //             "firstpartycookies_utag_main_ses_id",
    //             "pageurl_full_url",
    //             "pageurl_path",
    //             "pageurl_domain",
    //             "udo_channel_closer",
    //             "eventtime",
    //             "Eventdate",
    //             "original_pageurl_querystring",
    //             "pageurl_querystring",
    //             "referrerurl_full_url",
    //             "referrerurl_domain",
    //             "udo_event_name",
    //             "udo_event_type",
    //             "udo_event_action",
    //             "udo_event_offer",
    //             "udo_click_category",
    //             "udo_event_target",
    //             "udo_event_title",
    //             "udo_event_attr1",
    //             "udo_event_attr2",
    //             "udo_event_attr3",
    //             "udo_event_attr4",
    //             "firstpartycookies__mkto_trk",
    //             "udo_partner_id",
    //             "udo_ut_event",
    //             "udo_partnerId",
    //             "udo_link_name",
    //             "udo_page_title",
    //             "udo_event_area",
    //             "udo_partner_authtype",
    //             "udo_feedback_comments",
    //             "udo_partner_seller_id",
    //             "udo_comscore_resp_id",
    //             "udo_demandbase_sid",
    //             "udo_db_sub_industry",
    //             "udo_db_revenue_range",
    //             "udo_db_industry",
    //             "udo_db_employee_range",
    //             "udo_db_audience_segment",
    //             "udo_db_audience",
    //             "udo_task_cta_id",
    //             "udo_partnercenter_id",
    //             "udo_data_bi_id",
    //             "udo_db_company_name",
    //             "udo_blade_name",
    //             "udo_personalized_blade_type",
    //             "udo_personalized_blade_rule",
    //             "udo_personalized_blade_name",
    //             "udo_oem_maascompany",
    //             "udo_oem_maascompany_id",
    //             "udo_filter_value",
    //             "udo_filter_category",
    //             "udo_search_category",
    //             "udo_search_results",
    //             "udo_cd_asset_id",
    //             "udo_search_term",
    //             "udo_blade_type",
    //             "udo_wt_mc_id"
    //         ],
    //         "filepathname": "Digital (5)/Digital/Silver/Digital_Silver_AllEventsRaw_Digital.Notebook/notebook-content.py"
    //     },
    //     {
    //         "tablename": "Session_MaxTime",
    //         "SchemaDump": "",
    //         "Tablesused": ["Bronze.All_Events_Raw_Historical"],
    //         "ColumnUsed": [
    //             "SessionID",
    //             "EventTime"
    //         ],
    //         "filepathname": "Digital (5)/Digital/Silver/Digital_Silver_AllEventsRaw_Digital.Notebook/notebook-content.py"
    //     },
    //     {
    //         "tablename": "All_Events_Raw_Digital",
    //         "SchemaDump": "SilverPublishSchema/All_Events_Raw_Digital",
    //         "Tablesused": ["Silver.All_Events_Raw"],
    //         "ColumnUsed": [
    //             "VisitorID",
    //             "firstpartycookies_utag_main_ses_id",
    //             "pageurl_full_url",
    //             "pageurl_path",
    //             "pageurl_domain",
    //             "udo_channel_closer",
    //             "eventtime",
    //             "Eventdate",
    //             "original_pageurl_querystring",
    //             "pageurl_querystring",
    //             "pageurl_querystring_Persisted",
    //             "pageurl_querystring_NonPersisted",
    //             "referrerurl_full_url",
    //             "referrerurl_domain",
    //             "ReferrerChannel",
    //             "ReferrerChannelWTMCID",
    //             "ChannelInfo",
    //             "udo_event_name",
    //             "udo_event_type",
    //             "udo_event_action",
    //             "udo_event_offer",
    //             "udo_click_category",
    //             "udo_event_target",
    //             "udo_event_title",
    //             "udo_event_attr1",
    //             "udo_event_attr2",
    //             "udo_event_attr3",
    //             "udo_event_attr4",
    //             "firstpartycookies__mkto_trk",
    //             "udo_partner_id",
    //             "udo_ut_event",
    //             "udo_partnerId",
    //             "udo_link_name",
    //             "udo_page_title",
    //             "udo_event_area",
    //             "Cookies_modified",
    //             "LocaleName",
    //             "DataMartExploration",
    //             "GlobalPageURL",
    //             "GlobalReferrerURL",
    //             "GlobalTargetURL",
    //             "PartnerID",
    //             "Partner_ID",
    //             "SessionID",
    //             "PracticeArea",
    //             "SearchTerm",
    //             "AssetName",
    //             "udo_partner_authtype",
    //             "udo_feedback_comments",
    //             "udo_partner_seller_id",
    //             "udo_comscore_resp_id",
    //             "udo_demandbase_sid",
    //             "udo_db_sub_industry",
    //             "udo_db_revenue_range",
    //             "udo_db_industry",
    //             "udo_db_employee_range",
    //             "udo_db_audience_segment",
    //             "udo_db_audience",
    //             "udo_task_cta_id",
    //             "udo_partnercenter_id",
    //             "udo_data_bi_id",
    //             "udo_db_company_name",
    //             "udo_blade_name",
    //             "udo_personalized_blade_type",
    //             "udo_personalized_blade_rule",
    //             "udo_personalized_blade_name",
    //             "udo_oem_maascompany",
    //             "udo_oem_maascompany_id",
    //             "Updated_oem_maascompany",
    //             "Updated_oem_maascompany_id",
    //             "udo_filter_value",
    //             "udo_filter_category",
    //             "udo_search_category",
    //             "udo_search_results",
    //             "udo_cd_asset_id",
    //             "udo_search_term",
    //             "udo_blade_type",
    //             "udo_wt_mc_id"
    //         ],
    //         "filepathname": "Digital (5)/Digital/Silver/Digital_Silver_AllEventsRaw_Digital.Notebook/notebook-content.py"
    //     },
    //     {
    //         "tablename": "Silver_FRADesignation",
    //         "SchemaDump": "Silver/FRADesignation",
    //         "Tablesused": [
    //             "Bronze/FactProgramMetricData",
    //             "Bronze/FactProgramSubcategoryData",
    //             "Bronze/DimPartner",
    //             "SPDTargetList"
    //         ],
    //         "ColumnUsed": [
    //             "PartnerGlobalID",
    //             "SolutionArea",
    //             "EnrollmentStatusKey",
    //             "EnrollmentStatus",
    //             "PointsGrouping",
    //             "MetricValue",
    //             "MetricThreshold",
    //             "MetricType",
    //             "Track",
    //             "UniqueSolutionAreaFlag",
    //             "PartnerOneKey",
    //             "MetricName",
    //             "rn",
    //             "PartnerOneID",
    //             "PartnerOneName",
    //             "Area",
    //             "CreditedTimezone",
    //             "TransformedSolutionArea",
    //             "isManaged",
    //             "MPLSegment",
    //             "TopPGA",
    //             "SPDStatus",
    //             "TargetType"
    //         ],
    //         "filepathname": "Digital (5)/Digital/Silver/CPA_Silver_FRADesignation.Notebook/notebook-content.py"
    //     }
    // ]
    // const goldDetails = [
    //     {
    //         "tablename": "FactNetworkPost",
    //         "SchemaDump": "GoldPublishSchema/FactNetworkPost",
    //         "Tablesused": [
    //             "Bronze.FactDailyActivityByPost",
    //             "Bronze.NetworkPost",
    //             "Bronze.Post",
    //             "Bronze.Network",
    //             "Bronze.ContactListSize",
    //             "Bronze.NetworkType"
    //         ],
    //         "ColumnUsed": [
    //             "NetworkPostIdentifier",
    //             "postid",
    //             "ReachCount",
    //             "ReactionCount",
    //             "CommentCount",
    //             "ShareCount",
    //             "OpenCount",
    //             "ClickedOnContents",
    //             "MultipleClicks",
    //             "TotalEngagement",
    //             "SendCount",
    //             "AccountCampaignId",
    //             "NetworkTypeId",
    //             "Channel"
    //         ],
    //         "filepathname": "Digital (5)/Digital/Gold/GTM Marketing/GTMM_Gold_FactNetworkPost.Notebook/notebook-content.py"
    //     },
    //     {
    //         "tablename": "Silver_MAPCompanyNameID",
    //         "SchemaDump": "",
    //         "Tablesused": ["Silver_All_Events_Raw_Historical"],
    //         "ColumnUsed": [
    //             "udo_oem_maascompany_id",
    //             "udo_oem_maascompany",
    //             "EventTime",
    //             "EventDate"
    //         ],
    //         "filepathname": "Digital (5)/Digital/Gold/Digital/Digital_Gold_DimOEMCompany.Notebook/notebook-content.py"
    //     },
    //     {
    //         "tablename": "Gold_DimOEMCompany",
    //         "SchemaDump": "DimOEMCompany",
    //         "Tablesused": ["Silver_MAPCompanyNameID"],
    //         "ColumnUsed": [
    //             "CompanyID",
    //             "CompanyName",
    //             "Rank"
    //         ],
    //         "filepathname": "Digital (5)/Digital/Gold/Digital/Digital_Gold_DimOEMCompany.Notebook/notebook-content.py"
    //     }
    // ]
    // const stagingtables = [
    //     {
    //         "tablename": "Bronze_All_Events_Raw_Historical",
    //         "ColumnsUsed": [
    //             "VisitorID",
    //             "firstpartycookies_utag_main_ses_id",
    //             "original_pageurl_full_url",
    //             "pageurl_full_url",
    //             "original_pageurl_path",
    //             "pageurl_path",
    //             "pageurl_domain",
    //             "udo_channel_closer",
    //             "eventtime",
    //             "Eventdate",
    //             "original_pageurl_querystring",
    //             "ori_pageurl_querystring",
    //             "pageurl_querystring",
    //             "pageurl_querystring_persisted",
    //             "pageurl_querystring_nonpersisted",
    //             "original_referrerurl_full_url",
    //             "referrerurl_full_url",
    //             "referrerurl_domain",
    //             "ReferrerChannel",
    //             "ReferrerChannelWTMCID",
    //             "ChannelInfo",
    //             "original_udo_event_name",
    //             "udo_event_name",
    //             "udo_event_type",
    //             "udo_event_action",
    //             "udo_event_offer",
    //             "udo_click_category",
    //             "original_udo_event_target",
    //             "udo_event_target",
    //             "original_udo_event_title",
    //             "udo_event_title",
    //             "udo_event_attr1",
    //             "udo_event_attr2",
    //             "udo_event_attr3",
    //             "original_udo_event_attr4",
    //             "udo_event_attr4",
    //             "firstpartycookies__mkto_trk",
    //             "udo_partner_id",
    //             "udo_ut_event",
    //             "udo_partner_mpn_id",
    //             "original_udo_link_name",
    //             "udo_link_name",
    //             "udo_page_title",
    //             "udo_event_area",
    //             "Cookies_modified",
    //             "LocaleName",
    //             "DataMartExploration",
    //             "GlobalPageURL",
    //             "GlobalReferrerURL",
    //             "GlobalTargetURL",
    //             "PartnerID",
    //             "MPNPartnerID",
    //             "SessionID",
    //             "PracticeArea",
    //             "SearchTerm",
    //             "AssetName",
    //             "udo_partner_authtype",
    //             "original_udo_feedback_comments",
    //             "udo_feedback_comments",
    //             "udo_partner_seller_id",
    //             "udo_comscore_resp_id",
    //             "udo_demandbase_sid",
    //             "udo_db_sub_industry",
    //             "udo_db_revenue_range",
    //             "udo_db_industry",
    //             "udo_db_employee_range",
    //             "udo_db_audience_segment",
    //             "udo_db_audience",
    //             "udo_task_cta_id",
    //             "udo_partnercenter_id",
    //             "udo_data_bi_id",
    //             "udo_db_company_name",
    //             "udo_blade_name",
    //             "udo_personalized_blade_type",
    //             "udo_personalized_blade_rule",
    //             "udo_personalized_blade_name",
    //             "udo_oem_maascompany",
    //             "udo_oem_maascompany_id",
    //             "Updated_oem_maascompany",
    //             "Updated_oem_maascompany_id",
    //             "udo_filter_value",
    //             "udo_filter_category",
    //             "udo_search_results",
    //             "udo_cd_asset_id",
    //             "original_udo_search_term",
    //             "udo_search_term",
    //             "udo_blade_type",
    //             "udo_wt_mc_id",
    //             "MonthYear"
    //         ]
    //     },
    //     {
    //         "tablename": "Bronze_All_Events_Raw_Digital",
    //         "ColumnsUsed": [
    //             "VisitorID",
    //             "firstpartycookies_utag_main_ses_id",
    //             "pageurl_full_url",
    //             "original_pageurl_full_url",
    //             "pageurl_domain",
    //             "uo_channel_closer",
    //             "eventtime",
    //             "Eventdate",
    //             "original_pageurl_querystring",
    //             "pageurl_querystring",
    //             "pageurl_querystring_persisted",
    //             "pageurl_querystring_nonpersisted",
    //             "original_referrerurl_full_url",
    //             "referrerurl_full_url",
    //             "referrerurl_domain",
    //             "ReferrerChannel",
    //             "ReferrerChannelWTMCID",
    //             "ChannelInfo",
    //             "original_udo_event_name",
    //             "udo_event_name",
    //             "udo_event_type",
    //             "udo_event_action",
    //             "udo_event_offer",
    //             "udo_click_category",
    //             "original_udo_event_target",
    //             "udo_event_target",
    //             "original_udo_event_title",
    //             "udo_event_title",
    //             "udo_event_attr1",
    //             "udo_event_attr2",
    //             "udo_event_attr3",
    //             "original_udo_event_attr4",
    //             "udo_event_attr4",
    //             "firstpartycookies__mkto_trk",
    //             "udo_partner_id",
    //             "udo_ut_event",
    //             "udo_partnerId",
    //             "original_udo_link_name",
    //             "udo_link_name",
    //             "udo_page_title",
    //             "udo_event_area",
    //             "Cookies_modified",
    //             "LocaleName",
    //             "DataMartExploration",
    //             "GlobalPageURL",
    //             "GlobalReferrerURL",
    //             "GlobalTargetURL",
    //             "PartnerID",
    //             "Partner_ID",
    //             "SessionID",
    //             "PracticeArea",
    //             "SearchTerm",
    //             "AssetName",
    //             "udo_partner_authtype",
    //             "original_udo_feedback_comments",
    //             "udo_feedback_comments",
    //             "udo_partner_seller_id",
    //             "udo_comscore_resp_id",
    //             "udo_demandbase_sid",
    //             "udo_db_sub_industry",
    //             "udo_db_revenue_range",
    //             "udo_db_industry",
    //             "udo_db_employee_range",
    //             "udo_db_audience_segment",
    //             "udo_db_audience",
    //             "udo_task_cta_id",
    //             "udo_partnercenter_id",
    //             "udo_data_bi_id",
    //             "udo_db_company_name",
    //             "udo_blade_name",
    //             "udo_personalized_blade_type",
    //             "udo_personalized_blade_rule",
    //             "udo_personalized_blade_name",
    //             "udo_oem_maascompany",
    //             "udo_oem_maascompany_id",
    //             "Updated_oem_maascompany",
    //             "Updated_oem_maascompany_id",
    //             "udo_filter_value",
    //             "udo_filter_category",
    //             "udo_search_results",
    //             "udo_cd_asset_id",
    //             "original_udo_search_term",
    //             "udo_search_term",
    //             "udo_blade_type",
    //             "udo_wt_mc_id",
    //             "MonthYear"
    //         ]
    //     },
    //     {
    //         "tablename": "FactPartnerSpecialization",
    //         "ColumnsUsed": [
    //             "PartnerGlobalID",
    //             "EnrollmentStartDate",
    //             "SpecializationName",
    //             "SpecializationStatus"
    //         ]
    //     },
    //     {
    //         "tablename": "DimPartner",
    //         "ColumnsUsed": [
    //             "PartnerGlobalID",
    //             "MembershipStatus",
    //             "PartnerOneID",
    //             "PartnerOneName",
    //             "PartnerOneKey"
    //         ]
    //     },
    //     {
    //         "tablename": "Bronze.AllEventsRaw_Historical",
    //         "ColumnsUsed": [
    //             "SessionID",
    //             "EventTime"
    //         ]
    //     },
    //     {
    //         "tablename": "Bronze.Final_URL_Tbl",
    //         "ColumnsUsed": [
    //             "Title",
    //             "Destinationurl",
    //             "BG",
    //             "Subgroup",
    //             "Region",
    //             "Channel",
    //             "Tactic",
    //             "CreatedOn",
    //             "CampaignStartDate",
    //             "CampaignEndDate",
    //             "DigitalConversions",
    //             "CampaignGoal",
    //             "Audience",
    //             "AudienceSize",
    //             "SolutionArea",
    //             "SolutionPlay",
    //             "ChannelType",
    //             "EDCouncil_ID",
    //             "Tactic_ID",
    //             "ChannelDetail",
    //             "Marketo_ID",
    //             "SiteCore_ID",
    //             "AllocadiaID",
    //             "Wtmc_id"
    //         ]
    //     },
    //     {
    //         "tablename": "Bronze.DimSalesGeography",
    //         "ColumnsUsed": [
    //             "LocaleName"
    //         ]
    //     },
    //     {
    //         "tablename": "Bronze.MarketGeography",
    //         "ColumnsUsed": [
    //             "LocaleName"
    //         ]
    //     },
    //     {
    //         "tablename": "Bronze.ReferrerChannelMapping",
    //         "ColumnsUsed": [
    //             "ReferrerDomain",
    //             "ReferrerChannel"
    //         ]
    //     },
    //     {
    //         "tablename": "FactProgramMetricData",
    //         "ColumnsUsed": [
    //             "PartnerGlobalID",
    //             "SolutionArea",
    //             "MetricValue",
    //             "MetricThreshold",
    //             "MetricType",
    //             "Track",
    //             "MetricName",
    //             "ProgramId"
    //         ]
    //     },
    //     {
    //         "tablename": "FactProgramSubcategoryData",
    //         "ColumnsUsed": [
    //             "PartnerGlobalID",
    //             "SolutionArea",
    //             "EnrollmentStatusKey",
    //             "EnrollmentStatus",
    //             "PointsGrouping",
    //             "UniqueSolutionAreaFlag"
    //         ]
    //     },
    //     {
    //         "tablename": "SPDTargetList",
    //         "ColumnsUsed": [
    //             "PartnerOneID",
    //             "PartnerOneName",
    //             "Area",
    //             "CreditedTimezone",
    //             "SolutionArea",
    //             "isManaged",
    //             "MPLSegment",
    //             "TargetType"
    //         ]
    //     },
    //     {
    //         "tablename": "Bronze_FactDailyActivityByPost",
    //         "ColumnsUsed": [
    //             "NetworkPostIdentifier",
    //             "Date",
    //             "ReachCount",
    //             "ReactionCount",
    //             "CommentCount",
    //             "ShareCount",
    //             "Opens",
    //             "ClickedOnContents",
    //             "MultipleClicks"
    //         ]
    //     },
    //     {
    //         "tablename": "Bronze_NetworkPost",
    //         "ColumnsUsed": [
    //             "NetworkPostIdentifier",
    //             "PostId",
    //             "PostedDateTime"
    //         ]
    //     },
    //     {
    //         "tablename": "Bronze_Post",
    //         "ColumnsUsed": [
    //             "postid"
    //         ]
    //     },
    //     {
    //         "tablename": "Bronze_Network",
    //         "ColumnsUsed": [
    //             "NetworkId",
    //             "NetworkTypeId"
    //         ]
    //     },
    //     {
    //         "tablename": "Bronze_ContactListSize",
    //         "ColumnsUsed": [
    //             "NetworkPostIdentifier",
    //             "ContactSize"
    //         ]
    //     },
    //     {
    //         "tablename": "Bronze_NetworkType",
    //         "ColumnsUsed": [
    //             "NetworkTypeId",
    //             "CategoryId"
    //         ]
    //     },
    //     {
    //         "tablename": "Silver_All_Events_Raw_Historical",
    //         "ColumnsUsed": [
    //             "udo_oem_maascompany_id",
    //             "udo_oem_maascompany",
    //             "EventTime",
    //             "EventDate"
    //         ]
    //     },
    //     {
    //         "tablename": "Silver_MAPCompanyNameID",
    //         "ColumnsUsed": [
    //             "CompanyID",
    //             "CompanyName",
    //             "Rank"
    //         ]
    //     }
    // ]

    // const loading = false

    const flattenArrayFields = (dataArray, arrayFields) => {
        const result = [];
        dataArray.forEach(item => {
            // Get all combinations of array fields
            const arraysToExpand = arrayFields.map(field => item[field] || []);
            const maxLen = Math.max(...arraysToExpand.map(arr => arr.length || 1), 1);

            for (let i = 0; i < maxLen; i++) {
                const newItem = { ...item };
                arrayFields.forEach(field => {
                    newItem[field] = (item[field] && item[field][i] !== undefined)
                        ? item[field][i]
                        : '';
                });
                result.push(newItem);
            }
        });
        return result;
    };

    // Explicit column name mappings for known columns
    const columnNameMappings = {
        'tablename': 'Table Name',
        'path': 'Path',
        'sqlconnection': 'SQL Connection',
        'sourcedetails': 'Source Details',
        'dumplocation': 'Dump Location',
        'columns': 'Columns',
        'filepathname': 'File Path Name',
        'schemadump': 'Schema Dump',
        'source': 'Source',
        'tableused': 'Table Used',
        'tablesused': 'Tables Used',
        'columnused': 'Column Used',
        'columnsused': 'Columns Used'
    };

    // Helper function to format column names to proper case with spaces
    const formatColumnName = (name) => {
        // Check explicit mapping first
        const lowerName = name.toLowerCase();
        if (columnNameMappings[lowerName]) {
            return columnNameMappings[lowerName];
        }
        
        // Handle numbers at the end (StagingUsed1 -> StagingUsed 1)
        let result = name.replace(/(\D)(\d)/g, '$1 $2');
        // Handle camelCase and PascalCase - insert space before each capital letter
        result = result.replace(/([a-z])([A-Z])/g, '$1 $2');
        // Split by common separators and rejoin with spaces
        return result
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };

    // Helper function to transform data with formatted column names
    const transformDataWithFormattedColumns = (data) => {
        if (!data || data.length === 0) return { data: [], columnMap: {} };
        
        const columnMap = {};
        const keys = Object.keys(data[0] || {});
        
        keys.forEach(key => {
            columnMap[key] = formatColumnName(key);
        });
        
        const transformedData = data.map(row => {
            const newRow = {};
            keys.forEach(key => {
                newRow[columnMap[key]] = row[key];
            });
            return newRow;
        });
        
        return { data: transformedData, columnMap };
    };

    // Helper function to auto-fit column widths and format sheet with styled headers
    const formatSheet = (ws, data) => {
        if (!data || data.length === 0) return ws;
        
        // Get all keys (column headers)
        const keys = Object.keys(data[0] || {});
        
        // Calculate max width for each column
        const colWidths = keys.map((key, colIndex) => {
            let maxWidth = key.length;
            data.forEach(row => {
                const value = row[key];
                if (value !== null && value !== undefined) {
                    const cellLength = String(value).length;
                    maxWidth = Math.max(maxWidth, cellLength);
                }
            });
            return { wch: Math.min(maxWidth + 3, 55) };
        });
        
        ws['!cols'] = colWidths;
        
        // Style header row (first row) - Dark blue like Excel table
        // xlsx-js-style requires patternType: 'solid' for fills
        const headerStyle = {
            font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
            fill: { patternType: 'solid', fgColor: { rgb: '4472C4' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: '4472C4' } },
                bottom: { style: 'thin', color: { rgb: '4472C4' } },
                left: { style: 'thin', color: { rgb: '4472C4' } },
                right: { style: 'thin', color: { rgb: '4472C4' } }
            }
        };
        
        // Style data cells
        const cellStyle = {
            alignment: { horizontal: 'left', vertical: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: 'D9D9D9' } },
                bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
                left: { style: 'thin', color: { rgb: 'D9D9D9' } },
                right: { style: 'thin', color: { rgb: 'D9D9D9' } }
            }
        };
        
        // Apply header styles
        keys.forEach((key, colIndex) => {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
            if (ws[cellRef]) {
                ws[cellRef].s = headerStyle;
            }
        });
        
        // Apply cell styles to data rows
        data.forEach((row, rowIndex) => {
            keys.forEach((key, colIndex) => {
                const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
                if (ws[cellRef]) {
                    ws[cellRef].s = cellStyle;
                }
            });
        });
        
        // Set row height for header
        ws['!rows'] = [{ hpt: 25 }];
        
        // Add autofilter for header row
        const lastCol = XLSX.utils.encode_col(keys.length - 1);
        const lastRow = data.length;
        ws['!autofilter'] = { ref: `A1:${lastCol}${lastRow + 1}` };
        
        return ws;
    };


    const downloadExcel = () => {
        const wb = XLSX.utils.book_new();

        // 1. Pipelines Sheet
        if (pipelines.length > 0) {
            const flattenedPipelines = flattenArrayFields(pipelines, ['Columns']);
            const { data: formattedPipelines } = transformDataWithFormattedColumns(flattenedPipelines);
            const pipelinesheet = formatSheet(XLSX.utils.json_to_sheet(formattedPipelines), formattedPipelines);
            XLSX.utils.book_append_sheet(wb, pipelinesheet, "Pipelines");
        }

        // 2. Bronze Layer Sheet
        if (bronzeDetails.length > 0) {
            const flattenedBronze = flattenArrayFields(bronzeDetails, ['TableUsed']);
            const { data: formattedBronze } = transformDataWithFormattedColumns(flattenedBronze);
            const bronzesheet = formatSheet(XLSX.utils.json_to_sheet(formattedBronze), formattedBronze);
            XLSX.utils.book_append_sheet(wb, bronzesheet, "Bronze Layer");
        }

        // 3. Silver Layer Sheet
        if (silverDetails.length > 0) {
            const flattenedSilver = flattenArrayFields(silverDetails, ['Tablesused', 'ColumnUsed']);
            const { data: formattedSilver } = transformDataWithFormattedColumns(flattenedSilver);
            const silversheet = formatSheet(XLSX.utils.json_to_sheet(formattedSilver), formattedSilver);
            XLSX.utils.book_append_sheet(wb, silversheet, "Silver Layer");
        }

        // 4. Gold Layer Sheet
        if (goldDetails.length > 0) {
            const flattenedGold = flattenArrayFields(goldDetails, ['Tablesused', 'ColumnUsed']);
            const { data: formattedGold } = transformDataWithFormattedColumns(flattenedGold);
            const goldsheet = formatSheet(XLSX.utils.json_to_sheet(formattedGold), formattedGold);
            XLSX.utils.book_append_sheet(wb, goldsheet, "Gold Layer");
        }

        // 5. Staging Table Column Sheet
        if (stagingtables.length > 0) {
            const flattenedStaging = flattenArrayFields(stagingtables, ['ColumnsUsed']);
            const { data: formattedStaging } = transformDataWithFormattedColumns(flattenedStaging);
            const stagingsheet = formatSheet(XLSX.utils.json_to_sheet(formattedStaging), formattedStaging);
            XLSX.utils.book_append_sheet(wb, stagingsheet, "Staging Table Column");
        }

        XLSX.writeFile(wb, "FabricEnhancedData.xlsx");
    }

    const showDownload =
        (pipelines.length !== 0 ||
            bronzeDetails.length !== 0 ||
            silverDetails.length !== 0 ||
            goldDetails.length !== 0 ||
            stagingtables.length !== 0) &&
        !loading;

    return (
        <>
            <LogoHeader />

            <AppBar
                position="sticky"
                elevation={4}
                sx={{
                    backgroundColor: '#059bbf !important',
                    px: 2,
                }}
            >
                <Toolbar
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                    }}
                >
                    {/* Left Side: Nav Items */}
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        {navItems.map((item, i) => {
                            const isActive = 
                                (flagpage === 3 && item.label === "Fabric Lineage View") ||
                                (flagpage === 2 && item.label === "Lineage View") ||
                                (flagpage === 4 && item.label === "POSOT Data Explorer") ||
                                (flagpage === undefined && item.label === "Data Analysis - Fabric Enhanced") ||
                                (!flagpage && flagpage !== 0 && item.label === "Data Analysis - Fabric Enhanced");
                            return (
                            <Button
                                key={i}
                                href={item.href}
                                sx={{
                                    borderRadius: "0px",
                                    color: isActive ? '#3A3A3A' : 'white',
                                    fontFamily: "Poppins, sans-serif",
                                    fontWeight: isActive ? 'bold' : 'normal',
                                    borderBottom: isActive ? '2px solid #3A3A3A' : 'none',
                                    textTransform: 'none',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        borderRadius: 1,
                                    },
                                }}
                            >
                                {item.label}
                            </Button>
                        )})}
                    </Box>

                    {/* Right Side: Download */}
                    {showDownload && (
                        <IconButton onClick={downloadExcel} sx={{ color: 'white' }}>
                            <DownloadIcon />
                        </IconButton>
                    )}
                </Toolbar>
            </AppBar>
        </>
    )
}

export default NavbarEnhanced