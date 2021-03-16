import React, { useState, useEffect } from 'react';
import {
	SafeAreaView,
	StyleSheet,
	ScrollView,
	View,
	Text,
	StatusBar,
	NativeModules,
	NativeEventEmitter,
	Button,
	Platform,
	FlatList,
	TouchableHighlight
} from 'react-native';
import * as Permissions from 'expo-permissions';

import { Colors } from 'react-native/Libraries/NewAppScreen';

import BleManager from 'react-native-ble-manager';
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const App = () => {
	const [isScanning, setIsScanning] = useState(false);
	const peripherals = new Map();
	const [list, setList] = useState([]);

	const startScan = () => {
		if (!isScanning) {
			BleManager.scan([], 3, true)
				.then(_results => {
					console.log('Scanning...');
					setIsScanning(true);
				})
				.catch(err => {
					console.error(err);
				});
		}
	};

	const handleStopScan = () => {
		console.log('Scan is stopped');
		setIsScanning(false);
	};

	const handleDisconnectedPeripheral = data => {
		setList(
			list.map(p => {
				if (p.id === data.peripheral) {
					return {
						...p,
						connected: false
					};
				}

				return p;
			})
		);

		console.log('Disconnected from ' + data.peripheral);
	};

	const handleUpdateValueForCharacteristic = data => {
		console.log(
			'Received data from ' +
				data.peripheral +
				' characteristic ' +
				data.characteristic,
			data.value
		);
	};

	const retrieveConnected = () => {
		BleManager.getConnectedPeripherals([]).then(results => {
			if (results.length == 0) {
				console.log('No connected peripherals');
			}

			console.log(results);

			for (var i = 0; i < results.length; i++) {
				var peripheral = results[i];
				peripheral.connected = true;
				peripherals.set(peripheral.id, peripheral);
				setList(Array.from(peripherals.values()));
				console.log('List:', list);
			}
		});
	};

	const handleDiscoverPeripheral = peripheral => {
		console.log('Got ble peripheral', peripheral);

		if (!peripheral.name) {
			peripheral.name = 'NO NAME';
		}

		peripherals.set(peripheral.id, peripheral);
		setList(Array.from(peripherals.values()));
	};

	const testPeripheral = async peripheral => {
		if (peripheral) {
			if (peripheral.connected) {
				console.log('Disconnecting');

				BleManager.disconnect(peripheral.id);
			} else {
				BleManager.connect(peripheral.id)
					.then(() => {
						let p = list.find(p => peripheral.id === p.id);
						console.log('Peripheral:', p);

						setList(
							list.map(p => {
								if (p.id === peripheral.id) {
									return {
										...p,
										connected: true
									};
								}

								return p;
							})
						);

						console.log('Connected to ' + peripheral.id);

						setTimeout(() => {
							/* Test read current RSSI value */
							BleManager.retrieveServices(peripheral.id).then(
								peripheralData => {
									console.log('Retrieved peripheral services', peripheralData);

									BleManager.readRSSI(peripheral.id).then(rssi => {
										console.log('Retrieved actual RSSI value', rssi);
										let p = peripherals.get(peripheral.id);
										if (p) {
											p.rssi = rssi;
											peripherals.set(peripheral.id, p);
											setList(Array.from(peripherals.values()));
										}
									});
								}
							);
						}, 900);
					})
					.catch(error => {
						console.log('Connection error', error);
					});
			}
		}
	};

	useEffect(() => {
		BleManager.start({ showAlert: false });

		bleManagerEmitter.addListener(
			'BleManagerDiscoverPeripheral',
			handleDiscoverPeripheral
		);
		bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan);
		bleManagerEmitter.addListener(
			'BleManagerDisconnectPeripheral',
			handleDisconnectedPeripheral
		);
		bleManagerEmitter.addListener(
			'BleManagerDidUpdateValueForCharacteristic',
			handleUpdateValueForCharacteristic
		);

		if (Platform.OS === 'android' && Platform.Version >= 23) {
			Permissions.getAsync(Permissions.LOCATION)
				.then(({ status }) => {
					if (status !== `granted`) {
						Permissions.askAsync(Permissions.LOCATION)
							.then(({ status: newStatus }) => {
								console.log(newStatus);
								if (newStatus !== `granted`) {
									console.log(`failed to get permissions`);
								}
							})
							.catch(console.log);
					}
				})
				.catch(console.log);
		}

		return () => {
			console.log('unmount');
			bleManagerEmitter.removeListener(
				'BleManagerDiscoverPeripheral',
				handleDiscoverPeripheral
			);
			bleManagerEmitter.removeListener('BleManagerStopScan', handleStopScan);
			bleManagerEmitter.removeListener(
				'BleManagerDisconnectPeripheral',
				handleDisconnectedPeripheral
			);
			bleManagerEmitter.removeListener(
				'BleManagerDidUpdateValueForCharacteristic',
				handleUpdateValueForCharacteristic
			);
		};
	}, []);

	const renderItem = item => {
		const color = item.connected ? 'green' : '#fff';
		return (
			<TouchableHighlight onPress={() => testPeripheral(item)}>
				<View style={[styles.row, { backgroundColor: color }]}>
					<Text
						style={{
							fontSize: 12,
							textAlign: 'center',
							color: '#333333',
							padding: 10
						}}
					>
						{item.name}
					</Text>
					<Text
						style={{
							fontSize: 10,
							textAlign: 'center',
							color: '#333333',
							padding: 2
						}}
					>
						RSSI: {item.rssi}
					</Text>
					<Text
						style={{
							fontSize: 8,
							textAlign: 'center',
							color: '#333333',
							padding: 2,
							paddingBottom: 20
						}}
					>
						{item.id}
					</Text>
				</View>
			</TouchableHighlight>
		);
	};

	return (
		<>
			<StatusBar barStyle="dark-content" />
			<SafeAreaView>
				<ScrollView
					contentInsetAdjustmentBehavior="automatic"
					style={styles.scrollView}
				>
					{global.HermesInternal == null ? null : (
						<View style={styles.engine}>
							<Text style={styles.footer}>Engine: Hermes</Text>
						</View>
					)}
					<View style={styles.body}>
						<View style={{ margin: 10 }}>
							<Button
								title={'Scan Bluetooth (' + (isScanning ? 'on' : 'off') + ')'}
								onPress={() => startScan()}
							/>
						</View>

						<View style={{ margin: 10 }}>
							<Button
								title="Retrieve connected peripherals"
								onPress={() => retrieveConnected()}
							/>
						</View>

						{list.length == 0 && (
							<View style={{ flex: 1, margin: 20 }}>
								<Text style={{ textAlign: 'center' }}>No peripherals</Text>
							</View>
						)}
					</View>
				</ScrollView>
				<FlatList
					data={list}
					renderItem={({ item }) => renderItem(item)}
					keyExtractor={item => item.id}
				/>
			</SafeAreaView>
		</>
	);
};

const styles = StyleSheet.create({
	scrollView: {
		backgroundColor: Colors.lighter
	},
	engine: {
		position: 'absolute',
		right: 0
	},
	body: {
		backgroundColor: Colors.white
	},
	sectionContainer: {
		marginTop: 32,
		paddingHorizontal: 24
	},
	sectionTitle: {
		fontSize: 24,
		fontWeight: '600',
		color: Colors.black
	},
	sectionDescription: {
		marginTop: 8,
		fontSize: 18,
		fontWeight: '400',
		color: Colors.dark
	},
	highlight: {
		fontWeight: '700'
	},
	footer: {
		color: Colors.dark,
		fontSize: 12,
		fontWeight: '600',
		padding: 4,
		paddingRight: 12,
		textAlign: 'right'
	}
});

export default App;
