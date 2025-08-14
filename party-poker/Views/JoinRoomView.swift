//
//  JoinRoomView.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import SwiftUI

struct JoinRoomView: View {
    @ObservedObject var roomManager: RoomManager
    let playerName: String
    @Environment(\.presentationMode) var presentationMode
    
    @State private var roomCode = ""
    @State private var showingAlert = false
    @State private var alertMessage = ""
    @State private var showingQRScanner = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                
                Text("Join a Poker Room")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .padding(.top, 50)
                
                Spacer()
                
                VStack(spacing: 20) {
                    // Manual code entry
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Room Code")
                            .font(.headline)
                            .foregroundColor(.primary)
                        
                        TextField("Enter 6-digit code", text: $roomCode)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .font(.title2)
                            .multilineTextAlignment(.center)
                            .keyboardType(.numberPad)
                            .onChange(of: roomCode) { newValue in
                                // Limit to 6 digits
                                if newValue.count > 6 {
                                    roomCode = String(newValue.prefix(6))
                                }
                            }
                    }
                    .padding(.horizontal, 40)
                    
                    Button(action: joinWithCode) {
                        HStack {
                            Image(systemName: "keyboard")
                            Text("Join with Code")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(roomCode.count == 6 ? Color.green : Color.gray)
                        .cornerRadius(12)
                    }
                    .disabled(roomCode.count != 6)
                    .padding(.horizontal, 40)
                    
                    // Divider
                    Text("OR")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    // QR Code scanner
                    Button(action: {
                        showingQRScanner = true
                    }) {
                        HStack {
                            Image(systemName: "qrcode.viewfinder")
                            Text("Scan QR Code")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .cornerRadius(12)
                    }
                    .padding(.horizontal, 40)
                }
                
                Spacer()
            }
            .navigationBarItems(
                leading: Button("Cancel") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
        .alert(isPresented: $showingAlert) {
            Alert(
                title: Text("Join Room"),
                message: Text(alertMessage),
                dismissButton: .default(Text("OK"))
            )
        }
        .sheet(isPresented: $showingQRScanner) {
            QRScannerView { code in
                roomCode = code
                joinWithCode()
            }
        }
    }
    
    private func joinWithCode() {
        roomManager.joinRoom(code: roomCode, playerName: playerName)
        presentationMode.wrappedValue.dismiss()
    }
}