import React, { useState, useEffect, useCallback } from 'react';
import Select from "react-select";
import { GrPowerReset } from "react-icons/gr";
import Navbar from './Navbar';
import TextUpdaterNode from './TextUpdaterNode.js';


import ReactFlow, {
    useNodesState, useEdgesState, addEdge, MiniMap, Controls, Background, MarkerType, getIncomers,
    getOutgoers,
    getConnectedEdges
} from 'reactflow';
import ColorSelectorNode from './CustomNode';

import 'reactflow/dist/style.css';
import '../App.css';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import { type } from '@testing-library/user-event/dist/type';

const initBgColor = '#F3F2F2';


const connectionLineStyle = { stroke: '#fff' };
const snapGrid = [20, 20];
const nodeTypes = {
    selectorNode: ColorSelectorNode,
};

const defaultViewport = { x: 0, y: 0, zoom: 1 };

// function OutputView({ StagingTables}) {
function OutputView() {

    let filteredJSON = outputJSON;
    const martTables = outputJSON.Repos.OCPStaging_Digital.MartTables.sort((a, b) => a.tablename.localeCompare(b.tablename));
    const [selectedTable, setSelectedTable] = useState('');
    const tableDropDown = martTables.map((table, index) => ({
        value: table.tablename,
        label: table.tablename
    }));

    const nodeTypes = { textUpdater: TextUpdaterNode };

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [maxNodeId, setMaxNodeId] = useNodesState('');
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const [checked, setChecked] = useState(false);

    const handleSelectChange = (event) => {
        setSelectedTable(event);
        // console.log(event.value)
    };

    const addLineage = (event, node) => {
        createLineage(1, node)
    };

    function getStagingTablesUsed(tablename) {
        const martTables = outputJSON.Repos.OCPStaging_Digital.MartTables;
        if (tablename.includes(".")) {
            tablename = tablename.split(".")[1];
        }
        const tables = martTables.filter(table => table.tablename === tablename);
        const stagingTablesUsed = tables.map(table => table.Stagingtableused).flat(); //array of all the staging tables
        return stagingTablesUsed;
    }

    function getExtractionDetails(tablename) {
        const extractedTables = outputJSON.Repos.OCPStaging_Digital.ExtractedTables;
        if (tablename.includes(".")) {
            tablename = tablename.split(".")[1];
        }
        const reqTables = extractedTables.filter(table => table.tablename === tablename || table.actualname === tablename || table.createdname === tablename);
        const extractDetails = reqTables.map(table => table.extractiondetails).flat(); //array of all the staging tables
        return extractDetails;
    }

    const handleSubmit = async () => {
        createLineage(0, selectedTable)
    }

    const handleReset = async () => {
        setSelectedTable('');
        setNodes([]);
        setEdges([]);
    }

    function createLineage(flag, details) {
        const newNodes = [];
        const newEdges = [];
        let nodeId, tableX, tableY, rootTable, rootNodeId;

        //Node for new node addition in Lineage
        // newNodes.push({
        //     id: String(-1),
        //     position: { x: '1000px', y: '100px' },
        //     data: { label: 'Add a New Node', value: '123' } 
        //     ,type: 'textUpdater'
        // });


        if (flag == 0) {
            nodeId = 0;
            rootTable = String(selectedTable.value)

            // Create root node for the tableName selected
            rootNodeId = nodeId++;
            tableX = -600;
            tableY = 300; // Initial y position for MartTable nodes

            newNodes.push({
                id: String(rootNodeId),
                position: { x: tableX, y: tableY },
                data: { label: rootTable }
                // ,type: 'input',
            });
        }
        else {
            nodeId = details.id;
            tableX = details.position.x; // Initial y position for MartTable nodes
            tableY = details.position.y;
            rootNodeId = nodeId;
            rootTable = details.data.label;
            // nodeId = nodes.length + 1;
            nodeId = Number(maxNodeId) + 1
        }

        const newPosition = { x: tableX + 300, y: tableY + 90 };

        // create nodes for all the staging tables used
        const stagingTables = getStagingTablesUsed(rootTable);
        let len = stagingTables.length;
        if (len > 0) {
            let cnt = 0;
            stagingTables.forEach(stagingTable => {
                let stagingTableNodeId;
                let posY = (cnt <= (len / 2)) ? -cnt : (len % cnt);
                if (!newNodes.some(node => node.data.label === stagingTable) && !nodes.some(node => node.data.label === stagingTable)) {
                    stagingTableNodeId = nodeId++;
                    newNodes.push({
                        id: String(stagingTableNodeId),
                        position: { x: newPosition.x, y: newPosition.y + (posY * 150) }, // x is constant, y increases
                        data: { label: stagingTable }
                        // type: 'output',
                    });
                    cnt++;
                }
                else {
                    // stagingTableNodeId = existingTableNodes.get(stagingTable);
                    let stagingTableNode = nodes.find(node => node.data.label === stagingTable) || newNodes.find(node => node.data.label === stagingTable);
                    stagingTableNodeId = stagingTableNode.id;
                }

                //Create Edges
                const edgeId = `${rootNodeId}-${stagingTableNodeId}`;
                if (!newEdges.some(edge => edge.id === edgeId) && !edges.some(edge => edge.id === edgeId)) {
                    newEdges.push({
                        id: edgeId, source: String(rootNodeId), target: String(stagingTableNodeId), type: "smoothstep",
                        markerEnd: {
                            type: MarkerType.Arrow,
                            width: 12,
                            height: 12,
                            color: '#8F8D9C',
                        },
                        style: {
                            strokeWidth: 1.8,
                            stroke: '#8F8D9C',
                        }
                    });
                }
            });
        }
        else {
            //Fetch Extraction details for the table if exists
            const extractDetails = getExtractionDetails(rootTable);
            if (extractDetails != '') {
                newNodes.push({
                    id: String(nodeId),
                    position: { x: newPosition.x, y: newPosition.y + 100 },
                    data: { label: extractDetails }
                    // ,type: 'input',
                });

                const edgeId = `${rootNodeId}-${nodeId}`;
                newEdges.push({
                    id: edgeId, source: String(rootNodeId), target: String(nodeId),
                    type: "smoothstep",
                    animated: true,
                    markerEnd: {
                        type: MarkerType.Arrow,
                        width: 12,
                        height: 12,
                        color: '#8F8D9C',
                    },
                    style: {
                        strokeWidth: 1.8,
                        stroke: '#8F8D9C',
                    }
                });
            }

            //Change the Node style
            setNodes((els) =>
                els.map((el) => {
                    if (el.data.label === rootTable) {
                        // Change the color of the clicked node
                        el.style = { ...el.style, background: '#fa8089', color: 'white' };
                    }
                    return el;
                })
            );

        }

        setMaxNodeId(nodeId);

        if (flag != 0) {
            setNodes((oldNodes) => [...oldNodes, ...newNodes]);
            setEdges((oldEdges) => [...oldEdges, ...newEdges]);
        }
        else {
            setNodes(newNodes);
            setEdges(newEdges);
        }
        setChecked(true)
    }

    const onNodesDelete = useCallback(
        (deleted) => {
            setEdges(
                deleted.reduce((acc, node) => {
                    const incomers = getIncomers(node, nodes, edges);
                    const outgoers = getOutgoers(node, nodes, edges);
                    const connectedEdges = getConnectedEdges([node], edges);

                    const remainingEdges = acc.filter((edge) => !connectedEdges.includes(edge));

                    const createdEdges = incomers.flatMap(({ id: source }) =>
                        outgoers.map(({ id: target }) => (
                            {
                                id: `${source}->${target}`, source, target, type: "smoothstep",
                                markerEnd: {
                                    type: MarkerType.Arrow,
                                    width: 12,
                                    height: 12,
                                    color: '#8F8D9C',
                                },
                                style: {
                                    strokeWidth: 1.8,
                                    stroke: '#8F8D9C',
                                }
                            }))
                    );

                    return [...remainingEdges, ...createdEdges];
                }, edges)
            );
        },
        [nodes, edges]
    );

    const onConnect = useCallback(
        (params) =>
            setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#fff' } }, eds)),
        []
    );

    return (
        <div className='m-4'>
            <Navbar />

            <Row className='m-2'>
                <Col>
                    {/* <Form.Select aria-label="Default select example" onChange={handleSelectChange}>
                        <option>---Select Table Name---</option>
                        {martTables.map((table, index) => (
                            <option key={index} value={table.tablename}>{table.tablename}</option>
                        ))}
                    </Form.Select> */}
                    <div className="dropdown-container">
                        <Select
                            options={tableDropDown}
                            placeholder="---Select Table Name---"
                            value={selectedTable}
                            onChange={handleSelectChange}
                            isSearchable={true}
                        />
                    </div>
                </Col>
                <Col md="auto">
                    <Button variant="info" type="submit" onClick={handleSubmit}>
                        View Lineage
                    </Button>
                </Col>
                <Col xs lg="2">
                    <Button variant="info" type="submit" onClick={handleReset}>
                        <GrPowerReset />
                    </Button>
                </Col>
            </Row>
            <Row className='m-2'>
                {checked ?

                    <div style={{ height: '800px', width: '100%' }}>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onNodeClick={addLineage}
                            onEdgesChange={onEdgesChange}
                            onNodesDelete={onNodesDelete}
                            onConnect={onConnect}
                            style={{ background: initBgColor }}
                            nodeTypes={nodeTypes}
                            connectionLineStyle={connectionLineStyle}
                            snapToGrid={true}
                            snapGrid={snapGrid}
                            defaultViewport={defaultViewport}
                            fitView
                            attributionPosition="bottom-left"
                        >
                            <Controls />
                            <MiniMap />
                            {/* <Background color="#48494B" variant="dots" gap={12} size={1} /> */}
                        </ReactFlow>
                    </div>

                    :
                    <>
                    </>
                }
            </Row>
        </div >
    )
}

export default OutputView