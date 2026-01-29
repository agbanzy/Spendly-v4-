import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface VirtualCard {
  id: number;
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
  balance: number;
  currency: string;
  status: string;
  type: string;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

export default function CardsScreen() {
  const { data: cards, isLoading, refetch } = useQuery({
    queryKey: ['cards'],
    queryFn: () => api.get<VirtualCard[]>('/api/cards'),
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatCardNumber = (number: string) => {
    return number.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818CF8" />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Virtual Cards</Text>
        <TouchableOpacity style={styles.addButton} testID="button-add-card">
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardsContainer}>
        {cards?.map((card, index) => (
          <View
            key={card.id}
            style={[
              styles.card,
              index % 2 === 0 ? styles.cardPrimary : styles.cardSecondary,
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardType}>
                <Ionicons name="card" size={24} color="#FFFFFF" />
                <Text style={styles.cardTypeText}>{card.type}</Text>
              </View>
              <View style={[styles.statusBadge, card.status === 'active' ? styles.statusActive : styles.statusInactive]}>
                <Text style={styles.statusText}>{card.status}</Text>
              </View>
            </View>

            <Text style={styles.cardNumber}>{formatCardNumber(card.cardNumber)}</Text>

            <View style={styles.cardDetails}>
              <View>
                <Text style={styles.cardLabel}>CARDHOLDER</Text>
                <Text style={styles.cardValue}>{card.cardholderName}</Text>
              </View>
              <View>
                <Text style={styles.cardLabel}>EXPIRES</Text>
                <Text style={styles.cardValue}>{card.expiryDate}</Text>
              </View>
              <View>
                <Text style={styles.cardLabel}>CVV</Text>
                <Text style={styles.cardValue}>***</Text>
              </View>
            </View>

            <View style={styles.cardBalance}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceAmount}>{formatCurrency(card.balance, card.currency)}</Text>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.cardAction} testID={`button-freeze-card-${card.id}`}>
                <Ionicons name="snow" size={20} color="#FFFFFF" />
                <Text style={styles.cardActionText}>Freeze</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cardAction} testID={`button-details-card-${card.id}`}>
                <Ionicons name="eye" size={20} color="#FFFFFF" />
                <Text style={styles.cardActionText}>Details</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cardAction} testID={`button-fund-card-${card.id}`}>
                <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                <Text style={styles.cardActionText}>Fund</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {(!cards || cards.length === 0) && !isLoading && (
          <View style={styles.empty}>
            <Ionicons name="card-outline" size={64} color="#64748B" />
            <Text style={styles.emptyText}>No virtual cards</Text>
            <Text style={styles.emptySubtext}>Create a virtual card to start spending</Text>
            <TouchableOpacity style={styles.createButton} testID="button-create-first-card">
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Create Card</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsContainer: {
    padding: 20,
    paddingTop: 0,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  cardPrimary: {
    backgroundColor: '#4F46E5',
  },
  cardSecondary: {
    backgroundColor: '#7C3AED',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTypeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  cardNumber: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 24,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  cardLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  cardBalance: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  cardAction: {
    alignItems: 'center',
    gap: 4,
  },
  cardActionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#94A3B8',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
